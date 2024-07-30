import {
  LoginBody,
  RecoveryPasswordBody,
  ResenEmailBodyI,
  SignUpBody,
} from './../interface/auth.interface';
import { Request, Response } from 'express';
import { HelperBody } from '../helpers';
import {
  PasswordCodesModel,
  UserModel,
  EmailCodesModel,
  DriverModel,
  TruckModel,
  CustomerModel,
} from '../models';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Config from '../config';
import {
  capitalizeWord,
  generateVerificationCode,
} from '../utils/stringManager';
import db from '../db/connection';
import { randomNumber } from '../utils/numberManager';
import sendCustomEmail from '../utils/Email';
import { asyncVerify } from '../utils/jwtMannager';

//helpers
const { checkBody, validRegexBody } = HelperBody;
//Variables de entorno
const { secret, urlBack, urlFront } = Config;

//Access to platform
const signIn = async (req: Request, res: Response) => {
  try {
    const { body } = req;
    const check = checkBody(body, ['email', 'password']);
    if (check) {
      return res.status(400).json({ msg: check });
    }

    body.email = body.email.toLowerCase();

    const valid = validRegexBody(body, {
      email: '^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z]{2,6}$',
    });

    if (valid) {
      return res.status(400).json({ msg: valid });
    }

    const { email, password }: LoginBody = body;
    const user: any = await UserModel.findOne({
      where: { email, status: true },
    });

    let signInUser;
    if (user.role === 'driver') {
      signInUser = await UserModel.findOne({
        where: { email, status: true },
        attributes: {
          exclude: ['password'],
        },
        include: [
          {
            model: DriverModel,
            as: 'driver',
            include: [{ model: TruckModel, as: 'truck' }],
          },
        ],
      });
    } else if (user.role === 'customer') {
      signInUser = await UserModel.findOne({
        where: { email, status: true },
        attributes: {
          exclude: ['password'],
        },
        include: [
          {
            model: CustomerModel,
            as: 'customer',
          },
        ],
      });
    } else if(user.role === 'admin'){
       signInUser = await UserModel.findOne({
        where: { email, status: true },
        attributes: {
          exclude: ['password'],
        },       
      });
    }
    else{
      throw new Error('Rol desconocido');
    }
    
    if (!user)
      return res.status(400).json({ msg: 'Usuario no encontrado' });

    //Comparamos la contraseña
    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid)
      return res.status(400).json({ msg: 'Contraseña incorrecta' });

    //Comprobamos si el usuario ya verificó su perfil
    if (!user.verified_email)
      return res
        .status(400)
        .json({ msg: 'El usuario no está verificado' });

    //Creamos el token de inicio de sesion
    const token = jwt.sign({ id: user.id }, secret);
    delete user.dataValues.password;
    delete user.dataValues.verified_email;
    delete user.dataValues.createdAt;
    delete user.dataValues.status;

    res.json({ token, user: signInUser });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: 'Error interno' });
  }
};

//Register a user
const signUp = async (req: Request, res: Response) => {
  const transaction = await db.transaction();
  try {
    
    const body: SignUpBody = req.body;
    
    //Checkeamos el body recibido
    const check = checkBody(body, [
      'email',
      'password',
      'confirmPassword',
      'name',
      'lastname',
      'role'
    ]);
    if (check) {
      return res.status(400).json({ msg: check });
    }

    // Verificamos que las contraseñas coincidan
    if (body.password !== body.confirmPassword) {
      return res
        .status(400)
        .json({ msg: 'Las contraseñas no coinciden' });
    }

    body.email = body.email.toLowerCase();
    body.name = body.name.trim();
    body.name = capitalizeWord(body.name);

    //Validamos el formato del body
    const valid = validRegexBody(body, {
      email: '^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z]{2,6}$',
      password: '^.{9,}$', //minimo 8 caracteres
    });

    if (valid) {
      return res.status(400).json({ msg: valid });
    }

    //Validamos que el usuario no exista ya
    const { email, password, name, lastname } = body;
    const user = await UserModel.findOne({
      where: { email, name, lastname },
    });

    if (user) return res.status(200).json({ user });

    //Creamos el hash para la contraseña
    body.password = await bcrypt.hash(password, 10);

    //Generamos un id aleatorio si la DB de usuarios está vacia
    const users: Array<any> = await UserModel.findAll();
    if (users.length === 0) body['id'] = randomNumber(4);

    //creamos el codigo de verificación
    const verificationCode = generateVerificationCode(40);
    const tokenVerificationCode = jwt.sign(
      { email, verificationCode },
      secret
    ); //Genera el token para solicitudes

    //Registramos el usuario
    const newUser: any = await UserModel.create(
      { ...body },
      { transaction }
    );

    //registramos el codigo de verificación
    await EmailCodesModel.create(
      {
        user_id: newUser.id,
        code: verificationCode,
      },
      { transaction }
    );

    //enviamos correo de verificación
    await sendCustomEmail(
      'Activar cuenta',
      [email],
      '../../assets/emails/verificationEmail.html',
      {
        user_name: name + '' + lastname,
        verifyLink: `${urlBack}api/auth/verify_email?token=${tokenVerificationCode}`,
      }
    );

    await transaction.commit();
    res.json({
      msg: '¡Usuario registrado!, revise su correo electronico para validarlo.',
      user: newUser,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);
    res.status(500).send(error);
    // res.status(500).json({ msg: "Error interno" });
  }
};

const verifyEmail = async (req: Request, res: Response) => {
  const transaction = await db.transaction();
  try {
    const { token } = req.query;
    //Verificamos si el token existe
    if (!token)
      return res
        .status(400)
        .json({ msg: 'No se envió el token de verificación' });

    //desencriptamos el token
    const decode: string | jwt.JwtPayload =
      (await asyncVerify(String(token), secret)) || '';

    const user: any = await UserModel.findOne({
      where: { email: decode.email },
    });

    if (!user)
      return res.status(400).json({ msg: 'Usuario no encontrado' });

    if (user.verified_email)
      return res
        .status(400)
        .json({ msg: 'Usuario ya está verificado' });

    const emailVerificationCode: any = await EmailCodesModel.findOne({
      where: { user_id: user.id, status: true },
    });

    if (
      !emailVerificationCode ||
      emailVerificationCode.code !== decode.verificationCode
    ) {
      return res.status(400).json({ msg: 'Error de verificación' });
    }

    //cambiamos el valor de la verificacion para verificar el usuario
    user.verified_email = true;
    await user.save({ transaction });

    //enviamos correo
    await sendCustomEmail(
      '!Cuenta verificada! 👍',
      [user.email],
      '../../assets/emails/activateEmail.html',
      {
        activateLink: `${urlFront}/login`,
      }
    );

    await transaction.commit();
    res.json({ msg: '¡Usuario verificado!' });
  } catch (error) {
    res.status(500).json({ msg: 'Error interno' });
  }
};

const resendVerifyEmail = async (req: Request, res: Response) => {
  const transaction = await db.transaction();
  try {
    const body: ResenEmailBodyI = req.body;
    const check = checkBody(body, ['email']);

    if (check) {
      return res.status(400).json({ msg: check });
    }

    body.email = body.email.toLowerCase();

    //Validamos el formato del body
    const valid = validRegexBody(body, {
      email: '^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z]{2,6}$',
    });

    if (valid) {
      return res.status(400).json({ msg: valid });
    }

    const { email } = body;
    const user: any = await UserModel.findOne({
      where: { email: email, status: true },
    });

    if (!user)
      return res.status(400).json({ msg: 'Usuario no encontrado.' });

    if (user.verified_email)
      return res
        .status(401)
        .json({ msg: 'Usuario ya está verificado.' });

    //creamos el codigo de verificación
    const verificationCode = generateVerificationCode(40);
    const tokenVerificationCode = jwt.sign(
      { email, verificationCode },
      secret
    );

    //Validamos si existe un codigo habilitado
    const emailVerificationCode: any = await EmailCodesModel.findOne({
      where: { user_id: user.id, status: true },
    });

    if (emailVerificationCode) {
      emailVerificationCode.status = false;
      await emailVerificationCode.save({ transaction });
    }

    //registramos el codigo de verificación
    await EmailCodesModel.create(
      {
        user_id: user.id,
        code: verificationCode,
      },
      { transaction }
    );

    //enviamos correo de verificación
    await sendCustomEmail(
      'Activar cuenta',
      [email],
      '../../assets/emails/recoverEmail.html',
      {
        user_name: user.name + ' ' + user.last_name,
        activateLink: `${urlBack}/api/auth/verify_email?token=${tokenVerificationCode}`,
      }
    );

    await transaction.commit();
    res
      .status(200)
      .json({ msg: 'Se envió un nuevo codigo a su correo!' });
  } catch (error) {
    console.log(error);
    await transaction.rollback();
    res.status(500).json({ msg: 'Error al enviar el mensaje' });
  }
};

//Restart password
const recoveryPassword = async (req: Request, res: Response) => {
  const transaction = await db.transaction();
  try {
    const { email }: RecoveryPasswordBody = req.body;

    if (!email)
      return res.status(400).json({ msg: '¡El email es requerido!' });

    const user: any = await UserModel.findOne({
      where: { email: email, status: true },
    });

    if (!user)
      return res
        .status(404)
        .json({ msg: 'Usuario no encontrado o desactivado' });

    //Extraemos todos los codigos asociados al cliente y que estén en un status verdadero
    const codes: any = await PasswordCodesModel.findAll({
      where: { user_id: user.id, status: true },
    });

    //Si encontramos mas codigos
    if (codes.length > 0) {
      codes.forEach(async (code: any, index: number) => {
        code.status = false;
        await code.save({ transaction });
      });
    }

    const codesUsers: Array<any> = await PasswordCodesModel.findAll({
      limit: 1,
    });
    const body: any = {
      code: generateVerificationCode(4),
      user_id: user.id,
    };

    if (codesUsers.length === 0) body['id'] = randomNumber(4);
    const new_code: any = await PasswordCodesModel.create(body, {
      transaction,
    });

    //enviamos correo de verificación
    await sendCustomEmail(
      'Cambio de contraseña',
      [email],
      '../../assets/emails/codePassword.html',
      {
        user_name: user.name,
        code: new_code.code,
      }
    );

    await transaction.commit();
    res.status(200).json({ msg: 'Mail enviado con exito' });
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({ msg: 'Error Interno' });
  }
};

const verifyCodePassword = async (req: Request, res: Response) => {
  try {
    const { email, code }: RecoveryPasswordBody = req.body;

    //Si no encontramos el email o el codigo
    if (!email || !code)
      return res
        .status(400)
        .json({ msg: 'El email y el codigo son requeridos!' });

    const user: any = await UserModel.findOne({
      where: { email: email.toLocaleLowerCase(), status: true },
    });

    if (!user)
      return res
        .status(404)
        .json({ msg: 'Usuario no encontrado o desactivado' });

    const codePasword: any = await PasswordCodesModel.findOne({
      where: { user_id: user.id, code: code.toUpperCase() },
    });

    if (!codePasword)
      return res
        .status(404)
        .json({ mgs: 'No se encontró el codigo' });

    if (!codePasword.status)
      return res.status(404).json({ mgs: 'Codigo vencido' });

    res.status(200).json({ msg: 'Ya puede cambiar su contraseña' });
  } catch (error) {
    res.status(500).json({ msg: 'Error interno' });
  }
};

const changePassword = async (req: Request, res: Response) => {
  const transaction = await db.transaction();
  try {
    const { email, code, password }: RecoveryPasswordBody = req.body;

    //requerido contraseña, codigo e email
    if (!email || !code || !password)
      return res
        .status(400)
        .json({ msg: 'Se requieren todos los campos!' });

    const user: any = await UserModel.findOne({
      where: { email: email.toLocaleLowerCase(), status: true },
    });

    if (!user)
      return res
        .status(404)
        .json({ msg: 'Usuario no encontrado o desactivado' });

    const codePasword: any = await PasswordCodesModel.findOne({
      where: { user_id: user.id, code: code.toUpperCase() },
    });

    if (!codePasword)
      return res
        .status(404)
        .json({ mgs: 'No se encontró el codigo' });

    if (!codePasword.status)
      return res.status(404).json({ mgs: 'Codigo vencido' });

    //Validamos el formato del body
    const valid = validRegexBody(
      { password },
      { password: '^(?=.{8,})(?=.*[A-Z])(?=.*[0-9])' }
    );

    if (valid) return res.status(403).json({ msg: valid });

    const newPassword = await bcrypt.hash(password, 10);

    user.password = newPassword;
    codePasword.status = false;
    await user.save({ transaction });
    await codePasword.save({ transaction });

    await transaction.commit();
    res
      .status(200)
      .json({ msg: 'Se cambió la contraseña exitosamente' });
  } catch (error) {
    res.status(500).json({ msg: 'Error interno' });
  }
};

const singleUser = async (req: Request, res: Response) => {
  try {
    
    const { userId } = req.params;
    console.log(userId)
    if ( !userId) {
      res.status(400).json({ msg: 'Usuario no encontrado' });
    }
    const user = await UserModel.findByPk(userId);

    if (!user ) {
      res.status(400).json({ msg: 'Usuario no encontrado' });
    }
    let sessionUser;
    if (user?.role === 'driver') {
      sessionUser = await UserModel.findByPk(userId, {
        attributes: {
          exclude: ['password'],
        },
        include: [
          {
            model: DriverModel,
            as: 'driver',
            include: [{ model: TruckModel, as: 'truck' }],
          },
        ],
      });
    } else if (user?.role === 'customer') {
      sessionUser = await UserModel.findByPk(userId, {
        attributes: {
          exclude: ['password'],
        },
        include: [
          {
            model: CustomerModel,
            as: 'customer',
          },
        ],
      });
    }else if (user?.role === 'admin') {
      sessionUser = await UserModel.findByPk(userId,{
        attributes: {
          exclude: ['password'],
        },
      });
    } 
    
    else {
      throw new Error('Rol desconocido');
    }
    const token = jwt.sign({ id: user.id }, secret);
    res.status(200).json({ token, user: sessionUser });
  } catch (error) {
    res.status(500).send(error);
  }
};

export default {
  signIn,
  signUp,
  verifyEmail,
  resendVerifyEmail,
  recoveryPassword,
  verifyCodePassword,
  changePassword,
  singleUser,
};
