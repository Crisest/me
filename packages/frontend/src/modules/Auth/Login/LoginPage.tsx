import Textbox from '@ui/Textbox/Textbox';
import Button from '@ui/Button/Button';
import styles from '@/modules/Auth/Login/LoginPage.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import { Route } from '@/enums/routerEnum';
import { Form } from 'react-aria-components';
import { useState } from 'react';
import { useLoginMutation } from '@/services/authService';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';
import { LoginPayload } from '@portfolio/common';
import AuthLayout from '@/modules/Auth/AuthLayout';

const getErrorMessage = (err: unknown): string => {
  const error = err as FetchBaseQueryError | SerializedError;
  if (!error || typeof error !== 'object')
    return 'An error occurred during login';

  if ('data' in error) {
    return (
      (error.data as { message?: string })?.message ||
      'An error occurred during login'
    );
  }
  if ('message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'An error occurred during login';
};

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [credentials, setCredentials] = useState<LoginPayload>({
    email: '',
    password: '',
  });
  const [login, { isLoading, error }] = useLoginMutation();

  const handleLogin = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    login(credentials);
  };

  const handleInputChange =
    (field: keyof LoginPayload) =>
    (value: string | React.ChangeEvent<HTMLInputElement>): void => {
      const newValue = typeof value === 'string' ? value : value.target.value;
      setCredentials(prev => ({ ...prev, [field]: newValue }));
    };

  const handleRegister = (): void => {
    navigate(Route.REGISTER, { state: location.state });
  };

  return (
    <AuthLayout>
      <div className={styles.container}>
        <h1 className={styles.title}>Welcome back</h1>
        <Form onSubmit={handleLogin}>
          <Textbox
            type="email"
            fullWidth
            placeholder="Email"
            aria-label="email"
            isRequired
            value={credentials.email}
            onChange={handleInputChange('email')}
            isDisabled={isLoading}
          />
          <Textbox
            type="password"
            fullWidth
            placeholder="Password"
            aria-label="password"
            isRequired
            value={credentials.password}
            onChange={handleInputChange('password')}
            isDisabled={isLoading}
          />
          {error && (
            <div className={styles.error}>{getErrorMessage(error)}</div>
          )}
          <Button
            variant="primary"
            type="submit"
            fullWidth
            isDisabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
          <Button
            variant="link"
            onPress={handleRegister}
            isDisabled={isLoading}
          >
            Register
          </Button>
        </Form>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;
