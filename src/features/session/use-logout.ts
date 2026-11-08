import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { authApi } from '@/api/endpoints'
import { guestCart } from '@/api/session-store'
import { switchSession } from './session'

export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: async () => {
      guestCart.clear()
      await switchSession(queryClient, null)
      await router.invalidate()
      await navigate({ to: '/', replace: true })
    },
  })
}
