import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function Home() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get('auth_status');

  if (authCookie) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
