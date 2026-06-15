import Dexie, { Table } from 'dexie';

export interface Settings {
  id: string;
  username: string;
  pinCode: string;
  defaultCurrency: string;
  themeMode: 'dark' | 'light';
  customColors: string;
  aiPreferences: string;
}

export interface Transaction {
  id?: number;
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
