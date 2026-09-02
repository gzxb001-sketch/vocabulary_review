export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateProductionEnv } = await import("@/lib/env");
    validateProductionEnv();

    const { startEmailScheduler } = await import("@/lib/email-scheduler");
    startEmailScheduler();
  }
}
