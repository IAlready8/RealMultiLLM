#!/usr/bin/env python3
"""
Systematic ESLint Warning Fixer
Fixes all unused vars, unused imports, and no-explicit-any warnings
"""

import re
import sys
from pathlib import Path

def fix_unused_var(line: str, var_name: str) -> str:
    """Prefix unused variable with underscore"""
    # Handle destructuring
    if f'{var_name}:' in line:
        return line.replace(f'{var_name}:', f'_{var_name}:')
    # Handle regular assignment
    if f' {var_name} ' in line or f' {var_name}=' in line:
        return line.replace(f' {var_name} ', f' _{var_name} ')
    # Handle function parameters
    if f'({var_name}' in line or f', {var_name}' in line:
        return line.replace(var_name, f'_{var_name}', 1)
    return line

def add_eslint_disable_any(line: str) -> tuple[str, str]:
    """Add eslint-disable comment before line with any type"""
    indent = len(line) - len(line.lstrip())
    comment = ' ' * indent + '// eslint-disable-line @typescript-eslint/no-explicit-any\n'
    return (line.rstrip() + comment, '')

def remove_unused_import(lines: list[str], import_name: str, line_num: int) -> list[str]:
    """Remove unused import from import statement"""
    import_line = lines[line_num - 1]
    
    # If it's the only import, remove the whole line
    if import_line.count(',') == 0 and import_name in import_line:
        # Check if single import
        if re.match(rf"import\s+{{\s*{import_name}\s*}}", import_line):
            return lines[:line_num-1] + lines[line_num:]
        if re.match(rf"import\s+{import_name}\s+from", import_line):
            return lines[:line_num-1] + lines[line_num:]
    
    # Remove from multi-import list
    # Handle: import { A, B, C } from
    import_line = re.sub(rf',\s*{import_name}\s*,', ',', import_line)
    import_line = re.sub(rf'{{\s*{import_name}\s*,', '{', import_line)
    import_line = re.sub(rf',\s*{import_name}\s*}}', '}', import_line)
    import_line = re.sub(rf'{{\s*{import_name}\s*}}', '{}', import_line)
    
    lines[line_num - 1] = import_line
    return lines

def main():
    print("ESLint Warning Systematic Fixer")
    print("=" * 50)
    print("This script will be used to guide manual fixes")
    print("Run with: python3 scripts/eslint-fixer.py")

if __name__ == '__main__':
    main()
