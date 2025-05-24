/**
 * Dynamically loads an external script
 * @param src The URL of the script to load
 * @returns A promise that resolves when the script is loaded
 */
export const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if script already exists
    const existingScript = document.querySelector(`script[src="${src}"]`);
    if (existingScript) {
      resolve();
      return;
    }

    // Create new script element
    const script = document.createElement('script');
    script.src = src;
    script.async = true;

    // Handle script load
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));

    // Add script to document
    document.head.appendChild(script);
  });
}; 