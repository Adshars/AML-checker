import api from './api';

const coreService = {
  checkEntity: (params) => {
    return api.get('/sanctions/check', { params }).then(response => response.data);
  }
};

export default coreService;
