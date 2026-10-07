import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/roles.js';
import {
  cancelRegistration,
  checkInParticipant,
  createRegistrationPaymentOrder,
  exportParticipantsCsv,
  myRegistrations,
  organizerEventAnalytics,
  participantsForEvent,
  registerForEvent,
  verifyRegistrationPayment,
} from '../controllers/registrationController.js';

const router = Router();

router.post('/:id/register', authenticate, authorizeRoles('customer', 'organizer', 'admin'), registerForEvent);
router.post('/:id/create-order', authenticate, authorizeRoles('customer', 'organizer', 'admin'), createRegistrationPaymentOrder);
router.post('/bookings/:registrationId/verify-payment', authenticate, authorizeRoles('customer', 'organizer', 'admin'), verifyRegistrationPayment);
router.post('/bookings/:registrationId/cancel', authenticate, authorizeRoles('customer', 'organizer', 'admin'), cancelRegistration);
router.get('/me', authenticate, myRegistrations);
router.get('/organizer/analytics', authenticate, authorizeRoles('organizer', 'admin'), organizerEventAnalytics);
router.get('/:id/participants', authenticate, authorizeRoles('organizer', 'admin'), participantsForEvent);
router.post('/:id/checkin', authenticate, authorizeRoles('organizer', 'admin'), checkInParticipant);
router.get('/:id/participants.csv', authenticate, authorizeRoles('organizer', 'admin'), exportParticipantsCsv);

export default router;
