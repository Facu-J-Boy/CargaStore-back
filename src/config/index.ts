//import path from "path";
import { config } from 'dotenv';

//config({ path: path.resolve(__dirname, "../../.env") });

config();

const Config = {
  //config app express and jwt secret
  port: process.env.PORT,
  secret: process.env.AUTH_JWT_SECRET || '',
  dev: process.env.NODE_ENV !== 'production',
  //DB
  hostDB: process.env.HOST_DB || '',
  userDB: process.env.USER_DB || '',
  portDB: process.env.PORT_DB || '',
  nameDB: process.env.NAME_DB || '',
  PasswordDB: process.env.PASSWORD_DB || '',
  urlDB: process.env.URL_DB || '',
  //Urls
  urlFront: process.env.URL_FRONT || '*',
  urlBack: process.env.URL_BACK,

  //Mail config
  hostMail: process.env.HOST_MAIL,
  portMail: Number(process.env.PORT_MAIL) || 0,
  userMail: process.env.USER_MAIL,
  passwordMail: process.env.PASSWORD_MAIL,

  //Certificado
  urlCertificado: process.env.URL_CERTIFICADO,

  //Paypal
  paypal_api_client: process.env.PAYPAL_API_CLIENT,
  paypal_api_secret: process.env.PAYPAL_API_SECRET,
  paypal_sandbox_api: process.env.PAYPAL_SANDBOX_API,
  paypal_live_api: process.env.PAYPAL_LIVE_API,
  redirect_base_url: process.env.REDIRECT_BASE_URL,
};

export default Config;
