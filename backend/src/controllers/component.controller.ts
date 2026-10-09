import { Request, Response } from 'express';
import { currentUserId } from '../middleware/authenticate';
import * as componentService from '../services/component.service';
import { sendSuccess } from '../utils/http';
import { componentParamSchema, idParamSchema } from '../validators/common';
import {
  componentInputSchema,
  reorderComponentsSchema,
  updateComponentSchema,
} from '../validators/recipe.validators';

export async function add(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const input = componentInputSchema.parse(req.body);
  sendSuccess(res, await componentService.addComponent(currentUserId(req), id, input), 201);
}

export async function update(req: Request, res: Response) {
  const { id, componentId } = componentParamSchema.parse(req.params);
  const input = updateComponentSchema.parse(req.body);
  sendSuccess(
    res,
    await componentService.updateComponent(currentUserId(req), id, componentId, input),
  );
}

export async function remove(req: Request, res: Response) {
  const { id, componentId } = componentParamSchema.parse(req.params);
  await componentService.deleteComponent(currentUserId(req), id, componentId);
  sendSuccess(res, { id: componentId });
}

export async function reorder(req: Request, res: Response) {
  const { id } = idParamSchema.parse(req.params);
  const { componentIds } = reorderComponentsSchema.parse(req.body);
  sendSuccess(res, await componentService.reorderComponents(currentUserId(req), id, componentIds));
}
