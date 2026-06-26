import { Injectable,BadRequestException,
  ConflictException, } from '@nestjs/common';
import { DataSource, Repository, Not, IsNull, LessThan } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

import { v4 as uuidv4 } from "uuid";

type UploadFile = {
  id: string;
  buffer: Buffer;
  mimetype: string;
};

@Injectable()


export class ChatService {
  constructor(
    private dataSource: DataSource,
    private storageService: StorageService,
  ) {}

  async startConversations(userId: any, id: any, country: any,body:any) {
   
  }
async startConversation(
  userId: any,
  id: any,
  country: any,
  bookingId: number,
  customerId: number,
) {
  // 1. Check existing conversation
  const existing = await this.dataSource.query(
    `
    SELECT id
    FROM conversations
    WHERE reference_id = ? AND created_by = ?
    LIMIT 1
    `,
    [bookingId, customerId],
  );

  if (existing.length) {
    return { conversation_id: existing[0].id };
  }

  // 2. Create conversation
  const result: any = await this.dataSource.query(
    `
    INSERT INTO conversations
      (category, reference_id, created_by)
    VALUES
      (?, ?, ?)
    `,
    ['bookings', bookingId, customerId],
  );

  const conversationId = result.insertId;

  // 3. Create system welcome message
  const message = `Welcome to Event Support. Your booking reference is #${bookingId}. Feel free to ask any questions regarding your event.`;

  await this.dataSource.query(
    `
    INSERT INTO messages
      (conversation_id, sender_type, sender_id, message,role,sent_at)
    VALUES
      (?, 'system', ?, ? ,? , NOW())
    `,
    [conversationId, userId, message,'them'],
  );

  return {
    conversation_id: conversationId,
  };
}

async getConversationMessages(conversationId: number, myUserId: number) {
  const messages = await this.dataSource.query(
    `
    SELECT 
      m.id,
      m.conversation_id,
      m.sender_id,
      m.sender_type,
      m.message,
      m.created_at
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
    `,
    [conversationId],
  );

  const formatTime = (date: any) => {
    return date
      ? new Date(date).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
  };

  return messages.map((msg: any) => {
    let from = "customer";

    // system messages
    if (msg.sender_type === "system") {
      from = "system";
    }

    // my own messages
    else if (msg.sender_id === myUserId) {
      from = "me";
    }

    // vendor/customer detection (optional upgrade)
    else if (msg.role_type === 2) {
      from = "me";
    } else {
      from = "customer";
    }

    return {
      from,
      text: msg.message,
      time: msg.sender_type === "system" ? "" : formatTime(msg.created_at),
    };
  });
}

async send_messages(body:any , id:any) {
await this.dataSource.query(
    `
    INSERT INTO messages
      (conversation_id, sender_type, sender_id, message,role,sent_at)
    VALUES
      (?, 'user', ?, ? ,? , NOW())
    `,
    [body.conservation_id, id, body.text,'me'],
  );
}

// ${booking.refNo}
}