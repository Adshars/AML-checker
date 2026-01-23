import { Container } from 'react-bootstrap';
import ScreeningPanel from '../components/ScreeningPanel';

const CheckPage = () => {
  return (
    <Container className="mt-4">
      <h2 className="mb-4">Verification Panel</h2>
      <ScreeningPanel />
    </Container>
  );
};

export default CheckPage;
