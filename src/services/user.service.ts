import { Request, Response } from 'express';
import CustomerModel from '../models/customers.model';
import DriverModel from '../models/drivers.model';
import { UserModel } from '../models';
import { isMulterSingleFile } from '../config/multerConfig';
import fs from 'fs';

const getAllCustomersAndDrivers = async (
  req: Request,
  res: Response
) => {
  try {
    // Trae clientes
    const customers = await CustomerModel.findAll(); // Obtiene todos los clientes

    // Trae conductores
    const drivers = await DriverModel.findAll(); // Obtiene todos los conductores

    // Verifica si no hay clientes ni conductores
    if (customers.length === 0 && drivers.length === 0) {
      // Si no hay clientes ni conductores, retorna un mensaje personalizado
      return res
        .status(200)
        .json({ msg: 'No hay clientes ni conductores aún' });
    }

    // Verifica si no hay conductores
    if (drivers.length === 0) {
      // Si no hay conductores, retorna un mensaje personalizado y los clientes
      return res
        .status(200)
        .json({ msg: 'No hay conductores aún', customers });
    }

    // Verifica si no hay clientes
    if (customers.length === 0) {
      // Si no hay clientes, retorna un mensaje personalizado y los conductores
      return res
        .status(200)
        .json({ msg: 'No hay clientes aún', drivers });
    }

    // Si hay clientes y conductores, retorna ambos en formato JSON
    return res.status(200).json({ customers, drivers });
  } catch (error) {
    // Maneja cualquier error interno y retorna un mensaje de error
    return res.status(500).json({ msg: 'Error interno' });
  }
};
const patchUser = async (req: Request, res: Response) => {
  const userId = Array.isArray(req.headers.id)
    ? req.headers.id[0]
    : req.headers.id;
  const {
    name, // string
    lastname, // string
  } = req.body;
  const regex = /^[a-zA-Z\s]+$/;
  const user = await UserModel.findByPk(userId);

  if (!isMulterSingleFile(req.file)) {
    console.log('error al subir los archivos: ', req.file);
    return res
      .status(400)
      .json({ msg: 'Error al subir los archivos' });
  }

  if (user?.profile_image) {
    fs.unlinkSync(user?.profile_image);
  }

  const file = req.file?.path;

  if (!regex.test(name)) {
    return res.status(400).json({
      msg: 'El nombre no puede contener números ni carácteres inválidos',
    });
  } else if (!name) {
    return res
      .status(400)
      .json({ msg: 'El nombre no puede estar vacío' });
  } else if (!regex.test(lastname)) {
    return res.status(400).json({
      msg: 'El apellido no puede contener números ni carácteres inválidos',
    });
  } else if (!lastname) {
    return res
      .status(400)
      .json({ msg: 'El apellido no puede estar vacío' });
  }

  try {
    const [updated] = await UserModel.update(
      { lastname, name, profile_image: file },
      {
        where: { id: userId },
      }
    );

    if (updated) {
      const updatedUser = await UserModel.findOne({
        where: { id: userId },
      });
      console.log('User updated successfully:', updatedUser);
      return res.status(200).json({
        msg: 'Se actualizar los datos del usuario con éxito',
      });
    }

    return res
      .status(400)
      .json({ msg: 'Usuario no pudo actualizarse' });
  } catch (error) {
    return res.status(500).json({ msg: 'Error interno' });
  }
};

export default { getAllCustomersAndDrivers, patchUser };
