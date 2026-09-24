import mongoose from "mongoose";

/** Enregistrement idempotent : réutilise le modèle déjà compilé (tests, HMR) sinon le crée. */
export function reuseOrCreate<T>(name: string, schema: mongoose.Schema): mongoose.Model<T> {
  return ((mongoose.models[name] ?? mongoose.model(name, schema)) as unknown as mongoose.Model<T>);
}
