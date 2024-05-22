import {
  Model,
  Table,
  Column,
  DataType,
  HasMany,
  BelongsTo,
  ForeignKey,
  PrimaryKey,
} from 'sequelize-typescript';
import Order from './orders.model';
import Users from './users.model';

interface CustomerAttributes {
  id?: string;
  company_name: string;
  cuit: number;
  company_phone: string;
  userId?: number;
}

@Table({ tableName: 'customers', timestamps: false })
export class Customer extends Model<CustomerAttributes> {
  @PrimaryKey
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
    allowNull: false,
  })
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  company_name!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  cuit!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  company_phone!: string;

  @ForeignKey(() => Users)
  @Column({
    type: DataType.BIGINT,
    allowNull: false,
  })
  userId!: number;

  @BelongsTo(() => Users)
  user!: Users;

  @HasMany(() => Order)
  orders!: Order[];

  async addOrder(order: Order): Promise<void> {
    if (!this.orders) {
      this.orders = [];
    }
    this.orders.push(order);
    await this.save();
  }
}

export default Customer;
