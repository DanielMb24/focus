// Appliqué avant chaque fichier de test : la vérification d'email est
// ACTIVE sous vitest (les cas "désactivé" la coupent explicitement).
process.env.REQUIRE_EMAIL_VERIFICATION = "true";
