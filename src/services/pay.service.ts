import { Request, Response } from 'express';
import {
  DriverModel,
  PayModel,
  UserModel,
  OrderModel,
  PackageModel,
  FeedbackModel,
} from '../models';
import { PayStatus } from '../models/pay.model';
import { PayInterface } from '../interface/pay.interface';
import axios from 'axios';
import Config from '../config';
import { getPaypalToken } from '../utils/GetPaypalToken';
import path from 'path';
import fs from 'fs';

const {
  urlBack,
  redirect_base_url,
  dev,
  paypal_sandbox_api,
  paypal_live_api,
} = Config;

const payDriver = async (req: Request, res: Response) => {
  try {
    const { driverId, total, orderId } = req.body as {
      driverId: string;
      total: number;
      orderId: number;
    };

    // Verificar si la orden asociada a orderId existe
    const order = await OrderModel.findByPk(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ msg: 'La orden asociada no existe' });
    }

    // Obtener el customerId de la orden
    const customerId = order.customerId;

    // Crear o actualizar el pago si ya existe
    let pay = await PayModel.findOne({
      where: { orderId: orderId, status: PayStatus.PENDIENTE },
    });

    if (!pay) {
      // Crear un nuevo pago si no existe
      pay = await PayModel.create({
        total: total,
        customerId: customerId,
        driverId: driverId || null,
        status: PayStatus.ACREDITADO,
        orderId: orderId,
      });
    } else {
      // Actualizar el pago existente
      pay.total = total;
      pay.customerId = customerId;
      pay.driverId = driverId;
      pay.status = PayStatus.ACREDITADO;
      await pay.save();
    }

    // Asociar el payId a la orden
    order.payId = pay.id;
    await order.save();

    res.status(200).json({ msg: 'Pago acreditado', pay });
  } catch (error) {
    res.status(500).send(error);
  }
};

const adminHistoryPay = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findByPk(userId, {
      include: [
        { model: PayModel, include: [DriverModel], as: 'pays' },
      ],
    });
    if (!user) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }
    // res.status(200).json({ pays: user.pays });
  } catch (error) {
    res.status(500).send(error);
  }
};

const driverHistoryPay = async (req: Request, res: Response) => {
  try {
    const { driverId } = req.params;
    const driver = await DriverModel.findByPk(driverId, {
      include: [
        {
          model: PayModel,
          include: [
            {
              model: UserModel,
              attributes: { exclude: ['password'] },
            },
          ],
          as: 'pays',
        },
      ],
    });
    if (!driver) {
      return res.status(404).json({ msg: 'Conductor no encontrado' });
    }
    res.status(200).json({ pays: driver.pays });
  } catch (error) {
    res.status(500).send(error);
  }
};

const payListWithFilter = async (req: Request, res: Response) => {
  const { status } = req.query; // pendiente | acreditado
  try {
    const allPays = await PayModel.findAll({
      where: { status },
      include: [
        {
          model: OrderModel,
          attributes: [
            'id',
            'pick_up_city',
            'pick_up_date',
            'delivery_date',
            'customerId',
            'invoicePath',
            'packageId',
          ],
          include: [
            {
              model: PackageModel,
              attributes: [
                'product_name',
                'weight',
                'type',
                'offered_price',
              ],
            },
          ],
        },
      ],
    });
    res.status(200).json({ pays: allPays });
  } catch (error) {
    res.status(500).send(error);
  }
};

const findPay = async (req: Request, res: Response) => {
  const { payId } = req.params;

  try {
    // Buscar el pago por payId
    const pay = await PayModel.findByPk(payId, {
      attributes: ['id', 'customerId', 'driverId', 'orderId'],
      include: [
        {
          model: OrderModel,
          attributes: [
            'pick_up_address',
            'pick_up_city',
            'delivery_address',
            'delivery_city',
            'pick_up_date',
            'delivery_date',
            'packageId',
          ],
          include: [
            {
              model: PackageModel,
              attributes: ['quantity', 'product_name'],
            },
          ],
        },
      ],
    });

    if (!pay) {
      return res.status(404).json({ msg: 'Pago no encontrado' });
    }

    // Buscar feedbacks del driver
    const feedbacks = await FeedbackModel.findAll({
      where: { driverId: pay.driverId },
      attributes: ['score', 'comment'],
    });

    res.status(200).json({ pay, feedbacks });
  } catch (error) {
    res.status(500).send(error);
  }
};

const createOrder = async (req: Request, res: Response) => {
  const { price, orderId } = req.query;
  try {
    const order = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: `${price}`,
          },
          description: `Orden #${orderId}`,
        },
      ],
      application_context: {
        brand_name: 'Carga Store',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${urlBack}api/pay/capture-order?orderId=${orderId}`,
        cancel_url: `${urlBack}api/pay/cancel-order?orderId=${orderId}`,
      },
    };

    const paypal_api = dev ? paypal_sandbox_api : paypal_live_api;

    //Generamos el token de Paypal
    const token = await getPaypalToken();

    const response = await axios.post(
      `${paypal_api}/v2/checkout/orders`,
      order,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.log({ error });
    return res.status(500).send('Something goes wrong');
  }
};

const captureOrder = async (req: Request, res: Response) => {
  const { token } = req.query;

  const orderId = req.query.orderId as string | undefined;

  try {
    const paypal_api = dev ? paypal_sandbox_api : paypal_live_api;

    const access_token = await getPaypalToken();

    const response = await axios.post(
      `${paypal_api}/v2/checkout/orders/${token}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );
    console.log('data: ', response.data);

    //Buscamos la order
    const order = await OrderModel.findByPk(orderId);

    //Actualizamos su estado de pago
    if (order) {
      order.paid = true;
      await order?.save();
    }

    //Archivo html
    const filePath = path.join(
      __dirname,
      '../../../public/payed.html'
    );

    // Leer el archivo HTML y enviarlo como respuesta
    fs.readFile(filePath, 'utf-8', (err, data) => {
      if (err) {
        return res.status(500).send('Error al leer el archivo HTML');
      }

      const htmlContent = data.replace(
        '{{REDIRECT_URL}}',
        `${redirect_base_url}/shipments`
      );

      // Enviar el HTML como respuesta
      res.send(htmlContent);
    });

    // return res.redirect('/payed.html');
  } catch (error) {
    console.log({ error });
    return res.status(500).send('Something goes wrong');
  }
};

const cancelOrder = (req: Request, res: Response) => {
  const { orderId } = req.query;
  res.redirect(`${redirect_base_url}/carga/${orderId}`);
};

export default {
  payDriver,
  adminHistoryPay,
  driverHistoryPay,
  payListWithFilter,
  findPay,
  createOrder,
  captureOrder,
  cancelOrder,
};
