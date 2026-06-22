import Dexie, { Table } from 'dexie';

export interface Settings {
  id: string;
  username: string;
  pinCode: string;
  defaultCurrency: string;
  themeMode: 'dark' | 'light';
  customColors: string;
  aiPreferences: string;
  syncGroupId?: string;   // persistent sync group ID (set once, never expires)
  biometricsEnabled?: boolean;
}

export interface Transaction {
  id?: number;
  uuid?: string;        // stable cross-device identifier (crypto.randomUUID)
  updatedAt?: number;   // unix ms — used for last-write-wins conflict resolution
  type: 'revenu' | 'depense';
  montant: number;
  devise: string;
  montantConverti: number;
  date: string;
  categorie: string;
  sousCategorie: string;
  item: string;
  tauxDuJour: number;
  imageFacture?: string;
  statutRecurrent?: string;
}

export interface Category {
  id?: number;
  type: 'revenu' | 'depense';
  nom: string;
  parentId?: number;
  emoji: string;
}

export interface Budget {
  id?: number;
  categorie: string;
  plafond: number;
  montantActuel: number;
  mois: number;
  annee: number;
}

export interface Project {
  id?: number;
  titre: string;
  description: string;
  montantCible: number;
  montantActuel: number;
  type: string;
  statut: 'actif' | 'terminé';
}

class FinAppDB extends Dexie {
  settings!: Table<Settings>;
  transactions!: Table<Transaction>;
  categories!: Table<Category>;
  budgets!: Table<Budget>;
  projects!: Table<Project>;

  constructor() {
    super('finapp-db');

    this.version(1).stores({
      settings: 'id, username, pinCode, defaultCurrency, themeMode, customColors',
      transactions: '++id, type, montant, devise, montantConverti, date, categorie, sousCategorie, item, tauxDuJour, imageFacture, statutRecurrent',
      categories: '++id, type, nom, parentId',
      budgets: '++id, categorie, plafond, montantActuel, mois, annee',
      projects: '++id, titre, description, montantCible, montantActuel, type, statut'
    });

    this.version(2).stores({
      settings: 'id, username, pinCode, defaultCurrency, themeMode, customColors, aiPreferences',
      transactions: '++id, type, montant, devise, montantConverti, date, categorie, sousCategorie, item, tauxDuJour, imageFacture, statutRecurrent',
      categories: '++id, type, nom, parentId, emoji',
      budgets: '++id, categorie, plafond, montantActuel, mois, annee',
      projects: '++id, titre, description, montantCible, montantActuel, type, statut'
    }).upgrade(tx => {
      return tx.table('categories').toCollection().modify((cat: Category) => {
        if (!cat.emoji) cat.emoji = '';
      });
    });

    // v3 — adds uuid + updatedAt on transactions, syncGroupId on settings
    this.version(3).stores({
      settings: 'id, username, pinCode, defaultCurrency, themeMode, customColors, aiPreferences, syncGroupId',
      transactions: '++id, uuid, type, montant, devise, montantConverti, date, categorie, sousCategorie, item, tauxDuJour, updatedAt',
      categories: '++id, type, nom, parentId, emoji',
      budgets: '++id, categorie, plafond, montantActuel, mois, annee',
      projects: '++id, titre, description, montantCible, montantActuel, type, statut'
    }).upgrade(tx => {
      const now = Date.now();
      return tx.table('transactions').toCollection().modify((t: Transaction) => {
        if (!t.uuid) {
          // Generate a stable UUID for existing transactions
          t.uuid = `legacy-${now}-${Math.random().toString(36).slice(2)}`;
        }
        if (!t.updatedAt) t.updatedAt = now;
      });
    });

    // Hooks for auto UUID/updatedAt and Sync Trigger
    const triggerSync = () => {
      setTimeout(async () => {
        const settings = await this.settings.get('user');
        if (settings?.syncGroupId) {
          const { autoPushIfOnline } = await import('./sync');
          autoPushIfOnline(settings.syncGroupId).catch(err => console.warn('[sync] Hook trigger push failed', err));
        }
      }, 200);
    };

    const generateUUID = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return 'tx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 11);
    };

    this.transactions.hook('creating', (primKey, obj) => {
      if (!obj.uuid) obj.uuid = generateUUID();
      if (!obj.updatedAt) obj.updatedAt = Date.now();
      triggerSync();
    });

    this.transactions.hook('updating', (mods) => {
      triggerSync();
      return { ...mods, updatedAt: Date.now() };
    });

    this.transactions.hook('deleting', () => {
      triggerSync();
    });

    this.categories.hook('creating', () => triggerSync());
    this.categories.hook('updating', () => triggerSync());
    this.categories.hook('deleting', () => triggerSync());

    this.budgets.hook('creating', () => triggerSync());
    this.budgets.hook('updating', () => triggerSync());
    this.budgets.hook('deleting', () => triggerSync());

    this.projects.hook('creating', () => triggerSync());
    this.projects.hook('updating', () => triggerSync());
    this.projects.hook('deleting', () => triggerSync());

    this.on('populate', () => {
      this.categories.bulkAdd([
        { type: 'revenu', nom: 'Salaires & Revenus', emoji: '💰', parentId: undefined },
        { type: 'revenu', nom: 'Investissements', emoji: '📈', parentId: undefined },
        { type: 'revenu', nom: 'Autres Revenus', emoji: '🎁', parentId: undefined },
        { type: 'depense', nom: 'Alimentation', emoji: '🍕', parentId: undefined },
        { type: 'depense', nom: 'Transport', emoji: '🚗', parentId: undefined },
        { type: 'depense', nom: 'Logement', emoji: '🏠', parentId: undefined },
        { type: 'depense', nom: 'Loisirs', emoji: '🎮', parentId: undefined },
        { type: 'depense', nom: 'Santé', emoji: '💊', parentId: undefined },
        { type: 'depense', nom: 'Factures', emoji: '📱', parentId: undefined },
        { type: 'depense', nom: 'Habillement', emoji: '👕', parentId: undefined },
        { type: 'depense', nom: 'Éducation', emoji: '📚', parentId: undefined },
      ]);
    });
  }
}

export const db = new FinAppDB();
