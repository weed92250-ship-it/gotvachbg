import { jsonResponse } from './utils.js';
import {
  listRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
} from './api/recipes.js';
import {
  listComments,
  addComment,
  deleteComment,
  allComments,
} from './api/comments.js';
import { login } from './api/login.js';
import { renderRecipePage, renderSitemap } from './render.js';
import { runDailyImport } from './mealdb.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // SEO страница за отделна рецепта (за търсачки/социални мрежи)
      if (path.startsWith('/recipe/') && method === 'GET') {
        const id = path.split('/')[2];
        return renderRecipePage(id, env);
      }

      // Динамичен sitemap
      if (path === '/sitemap.xml' && method === 'GET') {
        return renderSitemap(env);
      }

      // API: рецепти
      if (path === '/api/recipes' && method === 'GET') {
        return listRecipes(env);
      }
      if (path === '/api/recipes' && method === 'POST') {
        return createRecipe(request, env);
      }
      const recipeMatch = path.match(/^\/api\/recipes\/([^/]+)$/);
      if (recipeMatch && method === 'GET') {
        return getRecipe(env, recipeMatch[1]);
      }
      if (recipeMatch && method === 'PUT') {
        return updateRecipe(request, env, recipeMatch[1]);
      }
      if (recipeMatch && method === 'DELETE') {
        return deleteRecipe(env, recipeMatch[1]);
      }

      // API: коментари
      if (path === '/api/all-comments' && method === 'GET') {
        return allComments(request, env);
      }
      const commentsMatch = path.match(/^\/api\/comments\/([^/]+)$/);
      if (commentsMatch && method === 'GET') {
        return listComments(env, commentsMatch[1]);
      }
      if (commentsMatch && method === 'POST') {
        return addComment(request, env, commentsMatch[1]);
      }
      if (commentsMatch && method === 'DELETE') {
        return deleteComment(request, env, commentsMatch[1]);
      }

      // API: вход в admin панела
      if (path === '/api/login' && method === 'POST') {
        return login(request, env);
      }

      // Ръчно стартиране на импорта (само за тестване, защитено с парола)
      if (path === '/api/run-import' && method === 'POST') {
        const key = request.headers.get('x-admin-key');
        if (!key || key !== env.ADMIN_PASSWORD) {
          return jsonResponse({ error: 'Unauthorized' }, 401);
        }
        const result = await runDailyImport(env);
        return jsonResponse(result);
      }

      // Всичко останало → статични файлове от public/
      return env.ASSETS.fetch(request);
    } catch (err) {
      return jsonResponse({ error: 'Server error', details: String(err) }, 500);
    }
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runDailyImport(env));
  },
};
