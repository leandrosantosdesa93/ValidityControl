import axios from 'axios';

const api = axios.create({
  baseURL: 'sua_url_base_aqui',
});

export const productService = {
  getAll: async () => {
    const response = await api.get('/products');
    return response.data;
  },
  
  create: async (productData: any) => {
    const response = await api.post('/products', productData);
    return response.data;
  },
};

export default api; 