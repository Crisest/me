export const readFileContent = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = event => {
      const content = event.target?.result as string;
      resolve(content);
    };

    reader.onerror = error => {
      reject(error);
    };

    reader.readAsText(file);
  });
};

export const computeFileHash = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const parseFileContent = async <T>(
  file: File,
  parser: (content: string) => T[],
): Promise<T[]> => {
  try {
    const content = await readFileContent(file);
    return parser(content);
  } catch (error) {
    console.error('Error parsing file:', error);
    throw error;
  }
};
