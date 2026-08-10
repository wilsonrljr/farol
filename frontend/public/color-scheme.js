(() => {
  try {
    const storedScheme = window.localStorage.getItem('mantine-color-scheme-value');
    const colorScheme =
      storedScheme === 'light' || storedScheme === 'dark' || storedScheme === 'auto'
        ? storedScheme
        : 'auto';
    const computedScheme =
      colorScheme !== 'auto'
        ? colorScheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';

    document.documentElement.setAttribute('data-mantine-color-scheme', computedScheme);
  } catch {
    // The document already has a safe light-mode fallback when storage is unavailable.
  }
})();
