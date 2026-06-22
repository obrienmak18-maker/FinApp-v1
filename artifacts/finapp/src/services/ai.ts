import { db } from './db';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/** Format an amount as natural French text — no ".00" */
function fmt(amount: number, currency = 'EUR'): string {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: rounded % 1 === 0 ? 0 : 2,
  }).format(rounded);
  return formatted;
}

export async function getLocalContext(): Promise<string> {
  const transactions = await db.transactions.toArray();
  const settings = await db.settings.get('user');
  const currency = settings?.defaultCurrency || 'EUR';
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const revenus = thisMonth.filter(t => t.type === 'revenu').reduce((s, t) => s + t.montantConverti, 0);
  const depenses = thisMonth.filter(t => t.type === 'depense').reduce((s, t) => s + t.montantConverti, 0);
  const solde = transactions.reduce((s, t) => t.type === 'revenu' ? s + t.montantConverti : s - t.montantConverti, 0);

  const catDeps: Record<string, number> = {};
  thisMonth.filter(t => t.type === 'depense').forEach(t => {
    catDeps[t.categorie] = (catDeps[t.categorie] || 0) + t.montantConverti;
  });
  const topCats = Object.entries(catDeps).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return `Contexte financier (devise : ${currency}):
- Solde global : ${fmt(solde, currency)}
- Revenus ce mois-ci : ${fmt(revenus, currency)}
- Dépenses ce mois-ci : ${fmt(depenses, currency)}
- Principales catégories de dépenses : ${topCats.map(([c, v]) => `${c} (${fmt(v, currency)})`).join(', ') || 'aucune'}
- Nombre de transactions ce mois : ${thisMonth.length}`;
}

export async function sendMessage(messages: Message[], userMessage: string): Promise<string> {
  const context = await getLocalContext();
  const settings = await db.settings.get('user');
  const currency = settings?.defaultCurrency || 'EUR';

  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const isOnline = navigator.onLine && Boolean(geminiKey);

  if (isOnline) {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      const systemPrompt = `Tu es Sofia, l'assistante financière personnelle de FinApp. Tu es chaleureuse, directe et bienveillante — comme une amie qui s'y connaît en finances. 

Règles absolues :
- Réponds TOUJOURS en français naturel et conversationnel.
- N'utilise JAMAIS de formatage robotique comme "0.00" ou "47.50". Écris les montants comme un humain : "environ 47 €", "à peu près 1 500 €", "presque 200 €".
- Évite les listes à puces et les titres markdown (##, ###, **). Préfère des phrases fluides.
- Sois concise — 2 à 4 phrases suffisent la plupart du temps.
- Utilise occasionnellement des emojis pour rendre la réponse vivante (✨💪😊💡).
- Si l'utilisateur n'a pas de données, dis-le avec humour sans être dramatique.

${context}`;

      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      history.push({ role: 'user', parts: [{ text: userMessage }] });

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: history
          }),
          signal: controller.signal,
        }
      );
      window.clearTimeout(timeout);

      if (!res.ok) {
        return generateLocalResponse(userMessage, context, currency);
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return reply || generateLocalResponse(userMessage, context, currency);
    } catch {
      return generateLocalResponse(userMessage, context, currency);
    }
  }

  return generateLocalResponse(userMessage, context, currency);
}

function generateLocalResponse(userMessage: string, context: string, currency = 'EUR'): string {
  const lower = userMessage.toLowerCase();

  // Parse values from context
  const soldeMatch = context.match(/Solde global : ([^\n]+)/);
  const revMatch = context.match(/Revenus ce mois-ci : ([^\n]+)/);
  const depMatch = context.match(/Dépenses ce mois-ci : ([^\n]+)/);
  const topCatMatch = context.match(/Principales catégories de dépenses : ([^\n]+)/);
  const nbTxMatch = context.match(/Nombre de transactions ce mois : (\d+)/);

  const soldeStr = soldeMatch?.[1] || 'inconnu';
  const revStr = revMatch?.[1] || 'inconnu';
  const depStr = depMatch?.[1] || 'inconnu';
  const topCatStr = topCatMatch?.[1] || 'aucune';
  const nbTx = nbTxMatch?.[1] || '0';

  const isZero = (str: string) => {
    const s = str.trim().toLowerCase();
    return s.startsWith('0') || s.startsWith('zéro') || s.includes('0,00') || s.includes('0.00');
  };

  if (lower.includes('solde') || lower.includes('combien')) {
    if (isZero(soldeStr)) {
      return `Votre solde est à zéro pour le moment. Dès que vous enregistrerez un revenu, vos finances commenceront à décoller ! 😊`;
    }
    return `Votre solde actuel est de ${soldeStr}. ${Number(nbTx) === 0 ? "Commencez à enregistrer vos transactions pour un suivi plus précis. 😊" : "C'est un très bon suivi, continuez comme ça ! 💪"}`;
  }

  if (lower.includes('dépense') || lower.includes('depense') || lower.includes('dépensé')) {
    if (isZero(depStr)) {
      return `Vous n'avez pas encore fait de dépenses ce mois-ci. C'est parfait pour votre épargne ! 😄`;
    }
    return `Ce mois-ci, vous avez dépensé environ ${depStr}. Vos dépenses les plus importantes concernent : ${topCatStr}. Faisons attention à ne pas dépasser vos limites ! 💡`;
  }

  if (lower.includes('revenu') || lower.includes('salaire') || lower.includes('gagné')) {
    if (isZero(revStr)) {
      return `Vous n'avez pas encore de revenus enregistrés pour ce mois. Pensez à ajouter vos rentrées pour équilibrer vos comptes ! 😊`;
    }
    return `Vos revenus de ce mois s'élèvent à ${revStr}. Avec vos dépenses de ${depStr}, vous gardez un bon équilibre. Félicitations ! ✨`;
  }

  if (lower.includes('économis') || lower.includes('economis') || lower.includes('épargn')) {
    return `Pour mieux économiser, voici trois réflexes simples : commencez par noter chaque petite dépense du quotidien, fixez-vous un objectif réaliste dans la section Projets, et essayez d'épargner automatiquement en début de mois. Chaque petit pas compte ! 💪`;
  }

  if (lower.includes('analys') || lower.includes('bilan') || lower.includes('résumé')) {
    const countText = Number(nbTx) > 0 ? `avec ${nbTx} transactions enregistrées` : "sans aucune transaction pour l'instant";
    return `Voici votre bilan de la période 📊 Vos revenus totalisent ${revStr} et vos dépenses s'élèvent à ${depStr}, ${countText}. Vos postes principaux sont : ${topCatStr}.`;
  }

  if (lower.includes('budget')) {
    return `Les budgets vous aident à garder le contrôle ! Allez dans l'onglet Budgets pour vous fixer des limites par catégorie. Je serai là pour vous alerter en cas de dépassement ! 🎯`;
  }

  if (lower.includes('projet') || lower.includes('objectif') || lower.includes('épargner')) {
    return `Un projet de voyage, d'achat ou de secours ? Créez-le dans la section Projets. Vous pourrez y allouer de l'épargne et suivre votre jauge de progression ! ✨`;
  }

  return `En ce moment, votre solde disponible est de ${soldeStr}, et vous avez dépensé ${depStr} ce mois-ci. Posez-moi des questions sur vos dépenses par catégorie ou demandez-moi des conseils d'épargne ! 😊`;
}
