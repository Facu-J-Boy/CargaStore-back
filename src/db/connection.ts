import { Sequelize } from 'sequelize-typescript';
import Config from '../config';
import {
  UserModel,
  CustomerModel,
  OrderModel,
  PackageModel,
  DriverModel,
} from '../models';
import EmailCodes from '../models/emailCodes.model';
import PasswordCodes from '../models/passwordCodes.model';
const { nameDB, userDB, PasswordDB, hostDB, portDB } = Config;

const db = new Sequelize({
  database: nameDB,
  username: userDB,
  password: PasswordDB,
  host: hostDB,
  dialect: 'mysql',
  logging: false,
  port: +portDB,
  timezone: '-05:00',
  models: [
    EmailCodes,
    PasswordCodes,
    UserModel,
    DriverModel,
    CustomerModel,
    OrderModel,
    PackageModel,
  ], // Aquí añades tus modelos
});

// db.sync({alter:true});
db.sync();

export default db;
