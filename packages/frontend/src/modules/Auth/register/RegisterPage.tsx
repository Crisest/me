import Textbox from '@components/Textbox/Textbox.tsx';
import Button from '@components/Button/Button.tsx';
import styles from '@/modules/Auth/Login/LoginPage.module.css';
import { useNavigate } from 'react-router-dom';
import { Route } from '@/enums/routerEnum';
import { Form } from 'react-aria-components';
import { RegisterPayload } from '@portfolio/common';
import { useState } from 'react';
import { useRegisterMutation } from '@/services/authService';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
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
      await register(formData).unwrap();
      // Redirect to login after successful registration
      navigate(Route.LOGIN);
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

  const ErrorMessage = ({ error }: { error: unknown }): JSX.Element | null => {
    if (!error) return null;
    return <div className={styles.error}>{getErrorMessage(error)}</div>;
  };

  return (
    <Form onSubmit={handleRegister} className={styles.container}>
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
      <ErrorMessage error={error} />
      <Button variant="primary" type="submit" fullWidth isDisabled={isLoading}>
        {isLoading ? 'Registering...' : 'Register'}
      </Button>
      <Button
        variant="link"
        onPress={() => navigate(Route.LOGIN)}
        isDisabled={isLoading}
      >
        Back to Login
      </Button>
    </Form>
  );
};

export default RegisterPage;
