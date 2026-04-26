export const loginConstraints = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 255,
    message: "Please enter a valid work email",
  },
  password: {
    required: true,
    minLength: 6,
    maxLength: 128,
    message: "Password must be at least 6 characters",
  },
};

export const signupConstraints = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 255,
    message: "Please enter a valid work email",
  },
  password: {
    required: true,
    minLength: 6,
    maxLength: 128,
    message: "Password must be at least 6 characters",
  },
  confirmPassword: {
    required: true,
    message: "Please confirm your password",
  },
};

export function validateField(value: string, constraints: {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  message: string;
}): string | null {
  if (constraints.required && !value.trim()) {
    return constraints.message;
  }
  if (constraints.minLength && value.length < constraints.minLength) {
    return constraints.message;
  }
  if (constraints.maxLength && value.length > constraints.maxLength) {
    return constraints.message;
  }
  if (constraints.pattern && value && !constraints.pattern.test(value)) {
    return constraints.message;
  }
  return null;
}

export function validateForm(
  formData: FormData,
  constraints: Record<string, any>
): Record<string, string> | null {
  const errors: Record<string, string> = {};
  for (const [key, constraint] of Object.entries(constraints)) {
    const value = formData.get(key) as string;
    const error = validateField(value || "", constraint);
    if (error) {
      errors[key] = error;
    }
  }
  return Object.keys(errors).length > 0 ? errors : null;
}