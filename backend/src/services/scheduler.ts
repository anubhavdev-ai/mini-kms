import cron from 'node-cron';
import { KeyService } from './keyService.js';
import { AuditService } from './auditService.js';
import { ActorContext } from '../types/index.js';

const schedulerActor: ActorContext = {
  principal: 'scheduler',
  role: 'admin',
  requestId: 'scheduler',
};

export function startRotationScheduler(keyService: KeyService, auditService: AuditService): void {
  cron.schedule('0 * * * *', async () => {
    try {
      const due = await keyService.listDueForRotation();
      for (const key of due) {
        const rotated = await keyService.rotateKey(key.id);
        await auditService.record(schedulerActor, 'KEY_ROTATE', 'SUCCESS', {
          reason: 'scheduled-rotation',
          keyId: key.id,
          newVersion: rotated.currentVersion,
        });
      }
    } catch (error) {
      await auditService.record(schedulerActor, 'KEY_ROTATE', 'FAILURE', {
        reason: 'scheduler-error',
        error: (error as Error).message,
      });
    }
  });
}
