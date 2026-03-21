/**
 * Scoring engine.
 * Calculates a resilience score (0–100) from REAL analysis results and project metadata.
 */
export function calculateScore(projectInfo, attackResults, review) {
  const totalChecks = attackResults.length;
  const passedChecks = attackResults.filter(a => a.passed).length;
  const q = projectInfo.qualitySignals || {};

  // --- Stability (35%) ---
  // Based on actual pass rate of checks
  const stabilityRaw = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 50;
  const stability = Math.round(stabilityRaw);

  // --- Error Handling & Security (35%) ---
  // Count real security/stability issues
  const criticalFails = attackResults.filter(a => !a.passed && a.severity === 'critical').length;
  const highFails = attackResults.filter(a => !a.passed && a.severity === 'high').length;
  const medFails = attackResults.filter(a => !a.passed && a.severity === 'medium').length;
  const severityPenalty = (criticalFails * 20) + (highFails * 12) + (medFails * 5);
  const errorHandling = Math.max(0, Math.min(100, 100 - severityPenalty));

  // --- Structure & Best Practices (30%) ---
  let structurePoints = 0;
  const readmeLength = (projectInfo.readme || '').length;

  // README quality (max 20)
  if (readmeLength > 2000) structurePoints += 20;
  else if (readmeLength > 500) structurePoints += 12;
  else if (readmeLength > 100) structurePoints += 5;

  // Real quality signals (max 80)
  if (q.hasTests) structurePoints += 15;
  if (q.hasCI) structurePoints += 12;
  if (q.hasDocker) structurePoints += 8;
  if (q.hasTypescript) structurePoints += 8;
  if (q.hasLinter) structurePoints += 7;
  if (q.hasLicense || projectInfo.license !== 'None') structurePoints += 5;
  if (q.hasSecurityPolicy) structurePoints += 5;
  if (q.hasEnvExample) structurePoints += 5;
  if (q.hasContributing) structurePoints += 3;
  if (q.hasEditorconfig || q.hasPrettier) structurePoints += 3;
  if (q.hasChangelog) structurePoints += 2;
  if (q.hasGitignore) structurePoints += 2;
  if ((projectInfo.recentCommits || 0) > 5) structurePoints += 5;

  const structure = Math.min(100, structurePoints);

  // --- Final Score ---
  const total = Math.round(
    (stability * 0.35) + (errorHandling * 0.35) + (structure * 0.30)
  );

  return {
    total: Math.max(0, Math.min(100, total)),
    breakdown: {
      stability,
      errorHandling,
      structure,
    },
    stats: {
      totalAttacks: totalChecks,
      passedAttacks: passedChecks,
      failedAttacks: totalChecks - passedChecks,
      criticalFails,
      highFails,
    },
  };
}
