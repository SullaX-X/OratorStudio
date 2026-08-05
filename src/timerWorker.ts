let interval: number | null = null;

self.onmessage = (e: MessageEvent) => {
  if (e.data === 'start') {
    if (interval) self.clearInterval(interval);
    interval = self.setInterval(() => {
      self.postMessage('tick');
    }, 1000) as unknown as number;
  } else if (e.data === 'stop') {
    if (interval) {
      self.clearInterval(interval);
      interval = null;
    }
  }
};
