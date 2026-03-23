import { create } from 'zustand'
import type { Recipe, QualityPrediction, RecipeIngredients } from '@/types'

type OptimizationMode = 'cost' | 'quality' | 'balanced'

interface RecipeState {
  recipes: Recipe[]
  selectedRecipe: Recipe | null
  draftRecipe: RecipeIngredients
  prediction: QualityPrediction | null
  isPredicting: boolean
  optimizationMode: OptimizationMode
  setRecipes: (recipes: Recipe[]) => void
  selectRecipe: (recipe: Recipe | null) => void
  updateDraftIngredient: (key: keyof RecipeIngredients, value: number) => void
  setDraftRecipe: (ingredients: RecipeIngredients) => void
  setPrediction: (prediction: QualityPrediction | null) => void
  setIsPredicting: (predicting: boolean) => void
  setOptimizationMode: (mode: OptimizationMode) => void
  addRecipe: (recipe: Recipe) => void
}

const defaultDraft: RecipeIngredients = {
  base_oil: 75,
  viscosity_modifier: 12,
  antioxidant: 2.5,
  detergent: 5,
  pour_point_depressant: 1.5,
}

export const useRecipeStore = create<RecipeState>((set) => ({
  recipes: [],
  selectedRecipe: null,
  draftRecipe: defaultDraft,
  prediction: null,
  isPredicting: false,
  optimizationMode: 'balanced',

  setRecipes: (recipes) => set({ recipes }),
  selectRecipe: (recipe) => set({ selectedRecipe: recipe }),

  updateDraftIngredient: (key, value) =>
    set((state) => ({
      draftRecipe: { ...state.draftRecipe, [key]: value },
    })),

  setDraftRecipe: (ingredients) => set({ draftRecipe: ingredients }),
  setPrediction: (prediction) => set({ prediction }),
  setIsPredicting: (isPredicting) => set({ isPredicting }),
  setOptimizationMode: (optimizationMode) => set({ optimizationMode }),
  addRecipe: (recipe) =>
    set((state) => ({ recipes: [recipe, ...state.recipes] })),
}))
