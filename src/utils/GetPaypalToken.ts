import axios from 'axios';
import Config from '../config';

const {
  dev,
  paypal_sandbox_api,
  paypal_live_api,
  paypal_api_client,
  paypal_api_secret,
} = Config;

export const getPaypalToken = async () => {
  const paypal_api = dev ? paypal_sandbox_api : paypal_live_api;

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');

  const response = await axios.post(
    `${paypal_api}/v1/oauth2/token`,
    params,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      auth: {
        username: `${paypal_api_client}`,
        password: `${paypal_api_secret}`,
      },
    }
  );

  return response.data.access_token;
};
