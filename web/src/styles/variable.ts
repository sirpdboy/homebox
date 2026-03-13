export enum ThemeVar {
  BackendColor = '--backend-color',
}

export function Var(varName: string, defaultValue?: any) {
  return `var(${varName}${defaultValue ? `, ${defaultValue}` : ''})`
}
