import { db } from './db';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function getLocalContext(): Promise<string> {
  const transactions = await db.transactions.toArray();
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

  return `Données financières du mois:
- Solde actuel: ${solde.toFixed(2)}
- Revenus ce mois: ${revenus.toFixed(2)}
- Dépenses ce mois: ${depenses.toFixed(2)}
- Top catégories de dépenses: ${topCats.map(([c, v]) => `${c}: ${v.toFixed(2)}`).join(', ')}
- Nombre de transactions ce mois: ${thisMonth.length}`;
}

export async function sendMessage(messages: Message[], userMessage: string): Promise<string> {
  const context = await getLocalContext();

  const isOnline = navigator.onLine;
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (isOnline && geminiKey) {
    try {
      const systemPrompt = `Tu es l'assistant financier de FinApp. Tu analyses les données financières de l'utilisateur et tu réponds en français de façon conversationnelle, courte et naturelle. Pas de headers markdown (## ou ###). Voici le contexte: ${context}`;
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
          })
        }
      );
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || generateLocalResponse(userMessage, context);
    } catch {
      return generateLocalResponse(userMessage, context);
    }
  }

  return generateLocalResponse(userMessage, context);
}

function generateLocalResponse(userMessage: string, context: string): string {
  const lower = userMessage.toLowerCase();

  if (lower.includes('solde')) {
    const match = context.match(/Solde actuel: ([\d.]+)/);
    return match ? `Votre solde actuel est de ${match[1]} dans votre devise de référence.` : "Je n'ai pas pu calculer votre solde.";
  }

  if (lower.includes('dépense') || lower.includes('depense')) {
    const match = context.match(/Dépenses ce mois: ([\d.]+)/);
    return match ? `Ce mois-ci, vous avez dépensé ${match[1]}. Essayez d'identifier les postes les plus importants pour voir où économiser.` : "Je n'ai pas trouvé vos dépenses ce mois.";
  }

  if (lower.includes('économis') || lower.includes('economis')) {
    return "Pour mieux économiser: suivez vos dépenses quotidiennement, fixez-vous des budgets par catégorie, et mettez de côté automatiquement un pourcentage de vos revenus dès réception.";
  }

  if (lower.includes('analys') || lower.includes('finance')) {
    return context.replace('Données financières du mois:\n', 'Voici votre bilan du mois: ');
  }

  return `Bonne question ! Voici votre situation: ${context.split('\n').slice(0, 3).join(', ')}. Que souhaitez-vous savoir de plus précis ?`;
}
