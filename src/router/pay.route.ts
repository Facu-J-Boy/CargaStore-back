import { Router } from 'express';
import { PayService } from '../services';
// import ValidJWT from "../middlewares/valid-jwt";

const router = Router();
//Servicios
const {
  payDriver,
  adminHistoryPay,
  driverHistoryPay,
  payListWithFilter,
  findPay,
  createOrder,
  captureOrder,
  cancelOrder,
} = PayService;

router.post('/create-order', createOrder);

router.get('/capture-order', captureOrder);

router.get('/cancel-order', cancelOrder);

router.post(
  '/pay_driver',
  // ValidJWT,
  payDriver
); //Esta ruta es para efectuar un pago del admin al conductor

router.get(
  '/admin_history/:userId',
  // ValidJWT,
  adminHistoryPay
);

router.get(
  '/driver_history/:driverId',
  // ValidJWT,
  driverHistoryPay
);

router.get(
  '/list_pays',
  // ValidJWT,
  payListWithFilter
); // filtra los pagos en pendientes o acreditados

router.get(
  '/find_pay/:payId',
  // ValidJWT,
  findPay
); //Trae los detalles de un pago para vista admin

module.exports = router;
