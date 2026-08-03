import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { NotificationService } from '../../notifications/notification.service';

@Injectable()
export class BookingService {
  constructor(private readonly dataSource: DataSource,
private readonly notificationService: NotificationService,

  ) {}
  createBooking(data: any) {
    return { message: 'booking created', data };
  }

  async profile_main_page(id: number) {
  const notifications = await this.dataSource.query(
    `
    SELECT *
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    `,
    [id],
  );


  const currentSql = `SELECT
    b.id AS bookingId,

    bed.id AS eventDateId,
    bed.event_date,
    DATEDIFF(bed.event_date, CURDATE()) AS daysLeft,

    bv.child_venue_id,
    bv.parent_venue_id,
    bv.venue_name_snapshot,

    bs.shift_name,
    bs.start_time,
    bs.end_time,
    bs.pax,
    bs.price,

    cv.child_venue_name,
    pv.venue_city,
    pv.venue_state,

    (
        SELECT attachment
        FROM venue_gallery vg
        WHERE vg.child_venue_id = bv.child_venue_id
          AND vg.image_type = 1
        LIMIT 1
    ) AS coverImage

FROM bookings b

INNER JOIN (
    SELECT
        booking_id,
        MIN(event_date) AS next_event_date
    FROM booking_event_dates
    WHERE event_date >= CURDATE()
    GROUP BY booking_id
) nextEvent
    ON nextEvent.booking_id = b.id

INNER JOIN booking_event_dates bed
    ON bed.booking_id = nextEvent.booking_id
   AND bed.event_date = nextEvent.next_event_date

INNER JOIN booking_venues bv
    ON bv.booking_id = b.id

LEFT JOIN booking_shifts bs
    ON bs.booking_id = b.id
   AND bs.event_date_id = bed.id
   AND bs.venue_id = bv.id

LEFT JOIN venue_child cv
    ON cv.child_venue_id = bv.child_venue_id

LEFT JOIN venue_parent pv
    ON pv.parent_venue_id = bv.parent_venue_id

WHERE
    b.created_by=? 
    AND b.booking_type = 'booked'
    AND b.status='active'
AND bed.event_date >= CURDATE()
ORDER BY bed.event_date ASC
LIMIT 1`;

const holdSql = `
SELECT
    b.id AS bookingId,
    b.reservation_end_date,

    bed.id AS eventDateId,
    bed.event_date,

    bv.child_venue_id,
    bv.parent_venue_id,
    bv.venue_name_snapshot,

    bs.shift_name,
    bs.start_time,
    bs.end_time,
    bs.pax,
    bs.price,

    cv.child_venue_name,
    pv.venue_city,
    pv.venue_state,

    (
        SELECT vg.attachment
        FROM venue_gallery vg
        WHERE vg.child_venue_id = bv.child_venue_id
          AND vg.image_type = 1
        LIMIT 1
    ) AS coverImage

FROM bookings b

INNER JOIN (
    SELECT
        booking_id,
        MIN(event_date) AS next_event_date
    FROM booking_event_dates
    WHERE event_date >= CURDATE()
    GROUP BY booking_id
) nextEvent
    ON nextEvent.booking_id = b.id

INNER JOIN booking_event_dates bed
    ON bed.booking_id = nextEvent.booking_id
   AND bed.event_date = nextEvent.next_event_date

INNER JOIN booking_venues bv
    ON bv.booking_id = b.id

LEFT JOIN booking_shifts bs
    ON bs.booking_id = b.id
   AND bs.event_date_id = bed.id
   AND bs.venue_id = bv.id

LEFT JOIN venue_child cv
    ON cv.child_venue_id = bv.child_venue_id

LEFT JOIN venue_parent pv
    ON pv.parent_venue_id = bv.parent_venue_id

WHERE
    b.created_by = ?
    AND b.booking_type = 'reserve'
    AND b.status = 'active'
    AND b.reservation_end_date >= NOW()
    AND b.reservation_end_date <= DATE_ADD(NOW(), INTERVAL 7 DAY)

ORDER BY b.reservation_end_date ASC
LIMIT 1;
`;
  const upcomingSql = `SELECT
    b.id AS bookingId,

    bed.id AS eventDateId,
    bed.event_date,
    DATEDIFF(bed.event_date, CURDATE()) AS daysLeft,

    bv.child_venue_id,
    bv.parent_venue_id,
    bv.venue_name_snapshot,

    bs.shift_name,
    bs.start_time,
    bs.end_time,
    b.total_pax as pax,
    bs.price,

    cv.child_venue_name,
    pv.venue_city,
    pv.venue_state,

    (
        SELECT attachment
        FROM venue_gallery vg
        WHERE vg.child_venue_id = bv.child_venue_id
          AND vg.image_type = 1
        LIMIT 1
    ) AS coverImage

FROM bookings b

INNER JOIN (
    SELECT
        booking_id,
        MIN(event_date) AS next_event_date
    FROM booking_event_dates
    WHERE event_date >= CURDATE()
    GROUP BY booking_id
) nextEvent
    ON nextEvent.booking_id = b.id

INNER JOIN booking_event_dates bed
    ON bed.booking_id = nextEvent.booking_id
   AND bed.event_date = nextEvent.next_event_date

INNER JOIN booking_venues bv
    ON bv.booking_id = b.id

LEFT JOIN booking_shifts bs
    ON bs.booking_id = b.id
   AND bs.event_date_id = bed.id
   AND bs.venue_id = bv.id

LEFT JOIN venue_child cv
    ON cv.child_venue_id = bv.child_venue_id

LEFT JOIN venue_parent pv
    ON pv.parent_venue_id = bv.parent_venue_id

WHERE
    b.created_by = ?
    AND b.booking_type = 'booked'
    AND b.status = 'active'
    AND bed.event_date >= CURDATE()

ORDER BY bed.event_date ASC
LIMIT 10 OFFSET 1;`



 const [currentBooking] = await this.dataSource.query(currentSql, [id]);

const [reservationHold] = await this.dataSource.query(holdSql, [id]);

const upcomingBookings = await this.dataSource.query(upcomingSql, [id]);

return {
  notification: notifications,
  currentBooking: currentBooking ?? null,
  reservationHold: reservationHold ?? null,
  upcomingBookings,
};

}  

async allbookingData(id: number) {

  const currentSql = `SELECT
    b.id AS id,
    b.booking_code AS bookingId,
   CONCAT(c.name, 's') AS name,

    cv.child_venue_name AS propertyName,
    cv.created_by AS vendor_id,
    cv.child_venue_id AS childVenueId,

    (
        SELECT vg.attachment
        FROM venue_gallery vg
        WHERE vg.child_venue_id = bv.child_venue_id
          AND vg.image_type = 1
        LIMIT 1
    ) AS image,

    pv.propety_category AS category,

    bed.event_date AS date,

    cv.guest_rooms AS nights,
    cv.guest_rooms AS guests,

    bs.shift_name AS shiftLabel,

    CONCAT(
        TIME_FORMAT(bs.start_time, '%h:%i %p'),
        ' - ',
        TIME_FORMAT(bs.end_time, '%h:%i %p')
    ) AS shiftTime,

    COALESCE(bs.price, 0) AS amountINR,

  

    b.notes AS specialRequest,

    /* Booking */
    b.booking_type AS bookingType,

 CASE
    WHEN b.status = 'cancelled' THEN 'cancelled'

    WHEN b.booking_type = 'enquiry' THEN 'enquiry'

    WHEN b.booking_type = 'reserve' THEN 'reservation'

    WHEN b.booking_type NOT IN ('enquiry', 'reserve')
         AND bed.event_date > CURDATE()
    THEN 'upcoming'

    WHEN b.booking_type NOT IN ('enquiry', 'reserve')
         AND bed.event_date = CURDATE()
    THEN 'ongoing'

    ELSE 'completed'
END AS bookingStatus,

    pv.venue_name AS vendorName,
    pv.venue_name AS vendorGSTIN,
    pv.venue_address AS address,
    pv.venue_state AS placeOfSupply,
    u.state AS customerState,

    b.reservation_end_date AS holdExpiresAt,
    b.total_amount AS total_amount,

    DATEDIFF(bed.event_date, CURDATE()) AS daysLeft,
    bed.event_date  as eventDate ,

    /* Payment Summary */
    COALESCE(ps.totalPaid, 0) AS totalPaid,

    COALESCE(bs.price, 0) AS totalAmount,

    GREATEST(
        COALESCE(bs.price, 0) - COALESCE(ps.totalPaid, 0),
        0
    ) AS pendingAmount,

    CASE
        WHEN COALESCE(ps.totalPaid, 0) >= COALESCE(bs.price, 0)
            THEN 'Paid'
        WHEN COALESCE(ps.totalPaid, 0) = 0
            THEN 'Unpaid'
        ELSE 'Pending'
    END AS paymentStatus,

    bp.payment_method AS paymentMode,
    bp.transaction_id,
    bp.payment_date,
    bp.paid_at,
    COALESCE(ps.paymentHistory, JSON_ARRAY()) AS paymentHistory

FROM bookings b

INNER JOIN booking_venues bv
    ON bv.booking_id = b.id

INNER JOIN category c
    ON c.id = b.category

INNER JOIN venue_child cv
    ON cv.child_venue_id = bv.child_venue_id

LEFT JOIN venue_parent pv
    ON pv.parent_venue_id = cv.parent_venue_id

INNER JOIN booking_event_dates bed
    ON bed.booking_id = b.id

LEFT JOIN booking_shifts bs
    ON bs.booking_id = b.id
   AND bs.event_date_id = bed.id
   AND bs.venue_id = bv.id

/* Payment Summary + History */
LEFT JOIN (
    SELECT
        booking_id,
        SUM(amount_paid) AS totalPaid,
        JSON_ARRAYAGG(
            JSON_OBJECT(
                'id', id,
                'paymentDate', payment_date,
                'paymentType', payment_type,
                'paymentMethod', payment_method,
                'transactionId', transaction_id,
                'amountPaid', amount_paid,
                'paymentStatus', payment_status,
                'paidAt', paid_at
            )
        ) AS paymentHistory
    FROM booking_payments
    GROUP BY booking_id
) ps
ON ps.booking_id = b.id

/* Latest Payment */
LEFT JOIN (
    SELECT p1.*
    FROM booking_payments p1
    INNER JOIN (
        SELECT
            booking_id,
            MAX(id) AS id
        FROM booking_payments
        GROUP BY booking_id
    ) p2
        ON p1.id = p2.id
) bp
ON bp.booking_id = b.id

LEFT JOIN users u
    ON u.id = b.created_by

WHERE
    b.created_by = ?

ORDER BY b.created_at DESC;`;




 const currentBooking = await this.dataSource.query(currentSql, [id]);






return {
  ALLBOOKINGS: currentBooking ?? null
};

}

async editRequest(body: any, userId: number) {
  const {
    booking_id,
    child_venue_id,
    category,
    reference_type,
    message,
    vendor_id,
  } = body;

  // Check conversation
  let conversation = await this.dataSource.query(
    `
    SELECT id
    FROM conversations
    WHERE reference_type = ?
      AND reference_id = ?
      AND category = ?
    LIMIT 1
    `,
    [reference_type, booking_id, category],
  );

  let conversationId: number;

  if (conversation.length) {
    conversationId = conversation[0].id;
  } else {
    const result: any = await this.dataSource.query(
      `
      INSERT INTO conversations
      (
        category,
        subject,
        venue_id,
        customer_id,
        vendor_id,
        reference_type,
        reference_id,
        created_by,
        created_at,
        updated_at
      )
      VALUES
      (?, ?, ?, ?, ?, ? , ? , ?, NOW(), NOW())
      `,
      [
        category,
        `Edit Request #${booking_id}`,
        child_venue_id,
       
        userId,
vendor_id,
 reference_type,
        booking_id,
        userId,
      ],
    );

    conversationId = result.insertId;
  }

  // Insert Message
  await this.dataSource.query(
    `
    INSERT INTO messages
    (
      conversation_id,
      sender_type,
      sender_id,
      role,
      message,
      is_read,
      sent_at,
      created_at
    )
    VALUES
    (?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [
      conversationId,
      'user',
      userId,
      'me',
      message,
      0,
    ],
  );

  // Update Conversation
  await this.dataSource.query(
    `
    UPDATE conversations
    SET
      last_message = ?,
      last_message_at = NOW(),
      unread_count = unread_count + 1,
      updated_at = NOW()
    WHERE id = ?
    `,
    [message, conversationId],
  );

  // Activity Log
  await this.createLog(
    'booking',
    booking_id,
    'edit_request',
    'Customer requested booking modification.',
    userId,
    null,
    {
      message,
    },
  );

  // Notification
  await this.notificationService.createNotification({
    type: 'Booking',
    referenceId: booking_id,
    title: 'Booking Edit Request',
    message: 'Customer has requested changes to the booking.',
    createdBy: userId,
  });

  // Socket
//   this.socketService.realtime(
//     userId.toString(),
//     'Booking',
//     'Your edit request has been sent successfully.',
//   );

  return {
    success: true,
    message: 'Edit request submitted successfully.',
    conversationId,
  };
}

async createLog(
  module: string,
  recordId: number,
  action: string,
  description: string,
  userId?: number,
  oldValue?: any,
  newValue?: any,
) {
  await this.dataSource.query(
  `
  INSERT INTO booking_logs
  (
    booking_id,
    action,
    description,
    old_value,
    new_value,
    created_by,
    created_at
  )
  VALUES (?,?,?,?,?,?,?)
  `,
  [
    recordId,
     module,
    description,
    null,
    JSON.stringify(newValue),
    userId,
    new Date(),
  ]
);

}
}
