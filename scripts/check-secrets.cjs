const { execSync } = require('child_process');
try {
  const result = execSync("git grep -E 'sb_secret_[^P]'", { encoding: 'utf-8' });
  // if grep succeeds, it means it found something
  if (result) {
    console.error('ERROR: Leaked Supabase secret key found in tracked files:');
    console.error(result);
    process.exit(1);
  }
} catch (e) {
  // git grep returns 1 when no matches are found, which means no secrets leaked.
  // We can ignore the error
  process.exit(0);
}
