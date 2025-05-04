import Textbox from '@components/Textbox/Textbox.tsx';
import Button from '@components/Button/Button.tsx';
import styles from '@/modules/Auth/Login/LoginPage.module.css';
import { useNavigate } from 'react-router-dom';
import { Route } from '@/enums/routerEnum';
import type { PressEvent } from 'react-aria';
import { Form } from 'react-aria-components';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const handleLogin = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    // TODO: Call login
    navigate(Route.GROUPS);
  };

  function handleRegister(event: PressEvent): void {
    console.log(event);
    // call login endpoint and redirect to budget
    throw new Error('Function not implemented.');
  }

  return (
    <Form onSubmit={handleLogin} className={styles.container}>
      <Textbox
        type="email"
        fullWidth
        placeholder="Email"
        aria-label="email"
        isRequired
      />
      <Textbox
        type="password"
        fullWidth
        placeholder="Password"
        aria-label="password"
        isRequired
      />
      <Button variant="primary" type="submit" fullWidth>
        Login
      </Button>
      <Button variant="link" onPress={handleRegister}>
        Register
      </Button>
    </Form>
  );
};

export default LoginPage;
