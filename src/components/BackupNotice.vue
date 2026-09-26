<script setup lang="ts">
import { computed, ref } from 'vue'
import { lastBackupDate, shareBackup } from '../data/backup'
import { db } from '../data/instance'
import { backupReminder, backupReminderText } from '../domain/backupReminder'
import { localDate } from '../domain/dates'
import { showToast } from '../ui/toast'

const props = defineProps<{ hasSessions: boolean }>()

const last = ref(lastBackupDate())
const reminder = computed(() => backupReminder(last.value, localDate(), props.hasSessions))
const busy = ref(false)

async function save() {
  if (busy.value) return
  busy.value = true
  try {
    const result = await shareBackup(db)
    if (result !== 'cancelled') {
      last.value = lastBackupDate()
      showToast(result === 'shared' ? 'Copia enviada.' : 'Copia descargada.')
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="reminder.due" class="notice notice-warn backup">
    <p>{{ backupReminderText(reminder) }}</p>
    <button type="button" class="btn" :disabled="busy" @click="save">Guardar copia</button>
  </div>
</template>

<style scoped>
.backup {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.backup .btn {
  align-self: flex-start;
  background: var(--surface);
}
</style>
