/**
 * Centralized subscription lifecycle management
 */

type CleanupFunction = () => void;

class SubscriptionManager {
  private subscriptions: Map<string, CleanupFunction> = new Map();

  register(channelName: string, cleanupFn: CleanupFunction): void {
    // Clean up existing subscription with same name if exists
    if (this.subscriptions.has(channelName)) {
      this.unregister(channelName);
    }
    this.subscriptions.set(channelName, cleanupFn);
  }

  unregister(channelName: string): void {
    const cleanupFn = this.subscriptions.get(channelName);
    if (cleanupFn) {
      cleanupFn();
      this.subscriptions.delete(channelName);
    }
  }

  unregisterAll(): void {
    this.subscriptions.forEach((cleanupFn) => {
      cleanupFn();
    });
    this.subscriptions.clear();
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  hasSubscription(channelName: string): boolean {
    return this.subscriptions.has(channelName);
  }
}

// Singleton instance
export const subscriptionManager = new SubscriptionManager();

