// kyc.service.ts

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

@Injectable()
export class KycService {
  constructor(
    private readonly dataSource: DataSource,
    private storageService: StorageService,
  ) {}

  async updateKyc(userId: any, body: any, files: any) {
    const {
      pan,
      bankName,
      accountNo,
      ifsc,
      accountType,
      bizName,
      bizType,
      gst,
      bizAddress,
    } = body;

    // upload files
    const panFileUrl = files?.panFile
      ? await this.storageService.upload(files.panFile, 'uploads/kyc/pan')
      : null;

    const aadhaarFileUrl = files?.aadhaarFile
      ? await this.storageService.upload(
          files.aadhaarFile,
          'uploads/kyc/aadhaar',
        )
      : null;

    const bizRegFileUrl = files?.bizRegFile
      ? await this.storageService.upload(
          files.bizRegFile,
          'uploads/kyc/business',
        )
      : null;

    const chequeFileUrl = files?.chequeFile
      ? await this.storageService.upload(files.chequeFile, 'uploads/kyc/cheque')
      : null;

    // PAN
    if (panFileUrl) {
      await this.dataSource.query(
        `
        INSERT INTO user_kyc_documents
        (
          user_id,
          document_type,
          document_number,
          file_url,
          verification_status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, NOW())
      `,
        [userId, 'pan', pan, panFileUrl, 'pending'],
      );
    }
    //ABCDE1234F 'pan','aadhar','bank_proof','gst','other'
    // Aadhaar
    if (aadhaarFileUrl) {
      await this.dataSource.query(
        `
        INSERT INTO user_kyc_documents
        (
          user_id,
          document_type,
          document_number,
          file_url,
          verification_status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, NOW())
      `,
        [userId, 'aadhar', '', aadhaarFileUrl, 'pending'],
      );
    }

    // Business Doc
    if (bizRegFileUrl) {
      await this.dataSource.query(
        `
        INSERT INTO user_kyc_documents
        (
          user_id,
          document_type,
          document_number,
          file_url,
          verification_status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, NOW())
      `,
        [userId, 'other', gst || '', bizRegFileUrl, 'pending'],
      );
    }

    // Cheque
    if (chequeFileUrl) {
      await this.dataSource.query(
        `
        INSERT INTO user_kyc_documents
        (
          user_id,
          document_type,
          document_number,
          file_url,
          verification_status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, NOW())
      `,
        [userId, 'bank_proof', accountNo, chequeFileUrl, 'pending'],
      );
    }

    // optional bank/business table save
    await this.dataSource.query(
      `
      INSERT INTO user_kyc_bank_details
      (
        user_id,
        bank_name,
        account_number,
        ifsc,
        account_type,
        business_name,
        business_type,
        gst_number,
        business_address,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
      [
        userId,
        bankName,
        accountNo,
        ifsc,
        accountType,
        bizName,
        bizType,
        gst,
        bizAddress,
      ],
    );

    return {
      success: true,
      message: 'KYC submitted successfully',
    };
  }
  async kyc_status(userId: any) {
    const result = await this.dataSource.query(
      `
  SELECT
  CASE
      WHEN d.rejected_count > 0
        OR b.verification_status = 'rejected'
      THEN 'rejected'

      WHEN d.total_docs = 0
        AND b.id IS NULL
      THEN 'pending'

      WHEN d.pending_count > 0
        OR b.verification_status = 'pending'
      THEN 'verification_in_progress'

      WHEN d.total_docs > 0
        AND d.total_docs = d.approved_count
        AND b.verification_status = 'approved'
      THEN 'approved'

      ELSE 'verification_in_progress'
  END AS kyc_status

  FROM
  (
      SELECT
          COUNT(*) AS total_docs,
          SUM(CASE WHEN verification_status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
          SUM(CASE WHEN verification_status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
          SUM(CASE WHEN verification_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count
      FROM user_kyc_documents
      WHERE user_id = ?
  ) d

  LEFT JOIN user_kyc_bank_details b
    ON b.user_id = ?

  LIMIT 1
  `,
      [userId, userId],
    );
    return result[0];
  }

  async each_kyc_status(userId: any) {
    const pan = await this.dataSource.query(
      `SELECT * FROM user_kyc_documents
   WHERE user_id = ?
   AND document_type = 'pan'
   ORDER BY id DESC
   LIMIT 1`,
      [userId],
    );

    const aadhaar = await this.dataSource.query(
      `SELECT * FROM user_kyc_documents
   WHERE user_id = ?
   AND document_type = 'aadhar'
   ORDER BY id DESC
   LIMIT 1`,
      [userId],
    );

    const business = await this.dataSource.query(
      `SELECT * FROM user_kyc_documents
   WHERE user_id = ?
   AND document_type = 'other'
   ORDER BY id DESC
   LIMIT 1`,
      [userId],
    );

    const cheque = await this.dataSource.query(
      `SELECT * FROM user_kyc_documents
   WHERE user_id = ?
   AND document_type = 'bank_proof'
   ORDER BY id DESC
   LIMIT 1`,
      [userId],
    );

    const bank = await this.dataSource.query(
      `SELECT * FROM user_kyc_bank_details
   WHERE user_id = ?
   ORDER BY id DESC
   LIMIT 1`,
      [userId],
    );

    return {
      pan: pan[0] || null,
      aadhaar: aadhaar[0] || null,
      business: business[0] || null,
      cheque: cheque[0] || null,
      bank: bank[0] || null,
    };
  }
}
