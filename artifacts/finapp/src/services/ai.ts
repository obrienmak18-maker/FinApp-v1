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

  if (lower.includes('solde') || lower.includes('combien')) {
    return `Votre solde actuel est de ${soldeStr}. ${Number(nbTx) === 0 ? "Commencez à enregistrer vos transactions pour un suivi plus précis 😊" : "Continuez comme ça 💪"}`;
  }

  if (lower.includes('dépense') || lower.includes('depense') || lower.includes('dépensé')) {
    if (depStr === '0 €' || depStr.includes('0 ')) {
      return `Vous n'avez aucune dépense enregistrée ce mois-ci. Soit vous êtes très économe, soit il faut commencer à tout noter ! 😄`;
    }
    return `Ce mois-ci, vous avez dépensé ${depStr}. Vos principales catégories : ${topCatStr}. Identifiez où couper si nécessaire 💡`;
  }

  if (lower.includes('revenu') || lower.includes('salaire') || lower.includes('gagné')) {
    if (revStr === '0 €' || revStr.includes('0 ')) {
      return `Aucun revenu enregistré ce mois-ci. Pensez à ajouter vos rentrées d'argent pour que je puisse vous aider ! 😊`;
    }
    return `Vos revenus de ce mois s'élèvent à ${revStr}. Avec ${depStr} de dépenses, vous gardez une bonne marge ✨`;
  }

  if (lower.includes('économis') || lower.includes('economis') || lower.includes('épargn')) {
    return `Pour mieux épargner, voici 3 réflexes simples : notez chaque dépense au moment où elle arrive, fixez-vous un objectif mensuel concret, et mettez de côté automatiquement dès que vous êtes payé. Petit à petit, ça fait une vraie différence 💪`;
  }

  if (lower.includes('analys') || lower.includes('bilan') || lower.includes('résumé')) {
    return `Voici votre bilan du mois 📊 Revenus : ${revStr}, dépenses : ${depStr}. Principales sorties : ${topCatStr}. ${Number(nbTx) > 0 ? `Vous avez enregistré ${nbTx} transactions ce mois.` : 'Commencez à enregistrer vos transactions !'}`;
  }

  if (lower.includes('budget')) {
    return `Les budgets, c'est votre meilleur allié ! Rendez-vous dans la section Budgets pour définir des plafonds par catégorie. Je vous aiderai à rester dans les clous 🎯`;
  }

  if (lower.includes('projet') || lower.includes('objectif') || lower.includes('épargner')) {
    return `Vous avez des projets en tête ? Direction la section Projets pour définir un montant cible et suivre votre progression. Chaque petit pas compte ✨`;
  }

  return `Bonne question ! En ce moment, votre solde est de ${soldeStr}, avec ${depStr} de dépenses ce mois. Vous pouvez me demander votre bilan, vos dépenses par catégorie, ou des conseils pour économiser 😊`;
}
