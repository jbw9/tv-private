// Your own settings, layered over config.js. Not committed (see .gitignore).
// No room here: deploy.sh gives each TV its own.
Object.assign(window.CONFIG, {
  name: 'JONATHAN',
  supabaseUrl: 'https://jbvkjvdthuzofvmhwctv.supabase.co',
  supabaseKey: 'sb_publishable_hbxcjbYF5H8py5gGLokxPg_tD9nGsNl',
  // Movies keeps Heartive's app ID (movies/config.xml). Its logo is linked in by link.sh.
  apps: [{ key: 'movies', name: 'MOVIES', short: 'MOVIES', color: '#1DA1F2', appId: 'HrtvTV0001.Heartive' }],
});
Object.assign(window.CONFIG, { spotifyClientId: "d3d064842b4748b5828341ef7af43b11", spotifyRefreshToken: "AQBiY6usbHa0BOahqJ3-VEtYDh-Ptqu2E7u2dVLSlLy09tI-rpOtfM-6Xk0RqfqwBmUKkrFaY071y_WXf1Qk3HdoN4iWhOAvpCqFuT_LfqH4WcgLacJFE4_T8eMCYufeZGg" });
