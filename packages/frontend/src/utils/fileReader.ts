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
