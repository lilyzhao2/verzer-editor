/**
 * Format version numbers consistently as V1V1, V2V1, etc.
 * Converts internal format (1b1, 2b1) to display format (V1V1, V2V1)
 */
export function formatVersionNumber(versionNumber: string): string {
  // Handle edge cases
  if (!versionNumber) return 'V0';
  
  // If it contains 'b', replace with 'V' (e.g., "1b1" -> "1V1")
  if (versionNumber.includes('b')) {
    const parts = versionNumber.split('b');
    return `V${parts[0].toUpperCase()}V${parts[1].toUpperCase()}`;
  }
  
  // If it contains '.', replace with 'V' (e.g., "1.1" -> "1V1")
  if (versionNumber.includes('.')) {
    const parts = versionNumber.split('.');
    return `V${parts[0].toUpperCase()}V${parts[1].toUpperCase()}`;
  }
  
  // If it contains '_', it's a user branch (e.g., "1b1_tony" -> "1V1_TONY")
  if (versionNumber.includes('_')) {
    const [version, user] = versionNumber.split('_');
    if (version.includes('b')) {
      const parts = version.split('b');
      return `V${parts[0].toUpperCase()}V${parts[1].toUpperCase()}_${user.toUpperCase()}`;
    }
    return `V${version.toUpperCase()}_${user.toUpperCase()}`;
  }
  
  // Otherwise, it's a root version (e.g., "1" -> "V1")
  return `V${versionNumber.toUpperCase()}`;
}

