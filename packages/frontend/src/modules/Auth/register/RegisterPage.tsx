import Textbox from '@ui/Textbox/Textbox';
import Button from '@ui/Button/Button';
import styles from '@/modules/Auth/Login/LoginPage.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { Route } from '@/enums/routerEnum';
import { Form } from 'react-aria-components';
import { RegisterPayload } from '@portfolio/common';
import { useState } from 'react';
import { useRegisterMutation } from '@/services/authService';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';
import AuthLayout from '@/modules/Auth/AuthLayout';

const getErrorMessage = (err: unknown): string => {
  const error = err as FetchBaseQueryError | SerializedError;
  if (!error || typeof error !== 'object')
    return 'An error occurred during registration';

  if ('data' in error) {
    return (
      (error.data as { message?: string })?.message ||
      'An error occurred during registration'
    );
  }
  if ('message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'An error occurred during registration';
};

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState<RegisterPayload>({
    email: '',
    password: '',
    name: '',
  });
  const [register, { isLoading, error }] = useRegisterMutation();

  const handleRegister = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    try {
      await register({
        ...formData,
        name: formData.name?.trim() || undefined,
      }).unwrap();
    } catch (err) {
      console.error('Registration failed:', err);
    }
  };

  const handleInputChange =
    (field: keyof RegisterPayload) =>
    (value: string | React.ChangeEvent<HTMLInputElement>): void => {
      const newValue = typeof value === 'string' ? value : value.target.value;
      setFormData(prev => ({ ...prev, [field]: newValue }));
    };

  return (
    <AuthLayout>
      <Form onSubmit={handleRegister} className={styles.container}>
        <h1 className={styles.title}>Create your account</h1>
        <Textbox
          type="email"
          fullWidth
          placeholder="Email"
          aria-label="email"
          isRequired
          value={formData.email}
          onChange={handleInputChange('email')}
          isDisabled={isLoading}
        />
        <Textbox
          type="text"
          fullWidth
          placeholder="Name"
          aria-label="name"
          value={formData.name}
          onChange={handleInputChange('name')}
          isDisabled={isLoading}
        />
        <Textbox
          type="password"
          fullWidth
          placeholder="Password"
          aria-label="password"
          isRequired
          value={formData.password}
          onChange={handleInputChange('password')}
          isDisabled={isLoading}
        />
        {error && <div className={styles.error}>{getErrorMessage(error)}</div>}
        <Button
          variant="primary"
          type="submit"
          fullWidth
          isDisabled={isLoading}
        >
          {isLoading ? 'Registering...' : 'Register'}
        </Button>
        <Button
          variant="link"
          onPress={() => navigate(Route.LOGIN, { state: location.state })}
          isDisabled={isLoading}
        >
          Back to Login
        </Button>
      </Form>
    </AuthLayout>
  );
};

export default RegisterPage;
