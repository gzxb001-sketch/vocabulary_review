export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startEmailScheduler } = await import("@/lib/email-scheduler");
    startEmailScheduler();
  }
}
