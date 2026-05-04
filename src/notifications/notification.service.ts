
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class NotificationService {
  constructor(private dataSource: DataSource) {}

  async createNotification(data: any) {
    await this.dataSource.query(
      `INSERT INTO notifications (user_id, title, message, type , reference_type, reference_id , is_read , read_at, created_at)
       VALUES (?, ?, ?, ? , ?, ?, ?, ? , ?)`,
      [
        data.user_id,
        data.title,
        data.message,
        data.type,
        data.reference_type,
        data.reference_id,
        data.is_read,
        data.read_at,
        data.created_at
      ],
    );
  }
}