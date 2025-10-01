/**
 * Format version numbers consistently as V1B1, V2B1, etc.
 * Converts internal format (1b1, 2b1) to display format (V1B1, V2B1)
 */
export function formatVersionNumber(versionNumber: string): string {
  // Handle edge cases
  if (!versionNumber) return 'V0';
  
  // If it contains 'b', keep as 'B' (e.g., "1b1" -> "V1B1")
  if (versionNumber.includes('b')) {
    const parts = versionNumber.split('b');
    return `V${parts[0].toUpperCase()}B${parts[1].toUpperCase()}`;
  }
  
  // If it contains '.', replace with 'B' (e.g., "1.1" -> "V1B1")
  if (versionNumber.includes('.')) {
    const parts = versionNumber.split('.');
    return `V${parts[0].toUpperCase()}B${parts[1].toUpperCase()}`;
  }
  
  // If it contains '_', it's a user branch (e.g., "1b1_tony" -> "V1B1_TONY")
  if (versionNumber.includes('_')) {
    const [version, user] = versionNumber.split('_');
    if (version.includes('b')) {
      const parts = version.split('b');
      return `V${parts[0].toUpperCase()}B${parts[1].toUpperCase()}_${user.toUpperCase()}`;
    }
    return `V${version.toUpperCase()}_${user.toUpperCase()}`;
  }
  
  // Otherwise, it's a root version (e.g., "1" -> "V1")
  return `V${versionNumber.toUpperCase()}`;
}

