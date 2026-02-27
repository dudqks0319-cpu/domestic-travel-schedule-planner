type SignupMemory = {
  email: string;
  nickname: string;
};

let signupMemory: SignupMemory | null = null;

export function setSignupMemory(value: SignupMemory): void {
  signupMemory = { ...value };
}

export function getSignupMemory(): SignupMemory | null {
  return signupMemory ? { ...signupMemory } : null;
}

export function clearSignupMemory(): void {
  signupMemory = null;
}
