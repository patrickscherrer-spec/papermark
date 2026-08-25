import {
  Brand,
  DataroomBrand,
  ItemType,
  LinkAudienceType,
  LinkType,
  PermissionGroupAccessControls,
  Prisma,
  ViewerGroupAccessControls,
} from "@prisma/client";

import { getFeatureFlags } from "@/lib/featureFlags";
import { resolveDataroomIndexEnabledForViewer } from "@/lib/featureFlags/dataroom-index-viewer";
import prisma from "@/lib/prisma";
import { sortItemsByIndexAndName } from "@/lib/utils/sort-items-by-index-name";

// ============================================================================
// Types
// ============================================================================

type LinkFetchStatus =
  | "ok"
  | "not_found"
  | "archived"
  | "deleted"
  | "expired"
  | "free"
  | "frozen";

export type ResolvedPublicLinkMeta = {
  enableCustomMetatag: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  metaImage: string | null;
  metaFavicon: string | null;
};

export type LinkFetchResult =
  | {
      status: "ok";
      linkType: LinkType;
      link: any;
      brand: Partial<Brand> | Partial<DataroomBrand> | null;
      linkId?: string;
      publicMeta: ResolvedPublicLinkMeta;
      /** Server-only resolved flag for dataroom visitor views (not serialized onto link). */
      dataroomIndexEnabledForViewer?: boolean;
    }
  | {
      status: Exclude<LinkFetchStatus, "ok">;
    };

// Common select object for link queries
const linkSelect = {
  id: true,
  expiresAt: true,
  emailProtected: true,
  emailAuthenticated: true,
  allowDownload: true,
  enableFeedback: true,
  enableScreenshotProtection: true,
  enableConfidentialView: true,
  password: true,
  isArchived: true,
  deletedAt: true,
  enableIndexFile: true,
  enableCustomMetatag: true,
  metaTitle: true,
  metaDescription: true,
  metaImage: true,
  metaFavicon: true,
  welcomeMessage: true,
  brandId: true,
  enableQuestion: true,
  linkType: true,
  feedback: {
    select: {
      id: true,
      data: true,
    },
  },
  enableAgreement: true,
  agreement: true,
  showBanner: true,
  enableWatermark: true,
  watermarkConfig: true,
  groupId: true,
  permissionGroupId: true,
  audienceType: true,
  dataroomId: true,
  dataroom: {
    select: {
      brandId: true,
    },
  },
  teamId: true,
  team: {
    select: {
      plan: true,
      globalBlockList: true,
    },
  },
  customFields: {
    select: {
      id: true,
      type: true,
      identifier: true,
      label: true,
      placeholder: true,
      required: true,
      disabled: true,
      orderIndex: true,
    },
    orderBy: {
      orderIndex: "asc" as const,
    },
  },
} satisfies Prisma.LinkSelect;

// Type for the link record returned by the common select query
type LinkRecord = Prisma.LinkGetPayload<{ select: typeof linkSelect }>;

// ============================================================================
// Internal Helpers
// ============================================================================

// Local mock function to replace resolveBaseBrand
async function resolveBaseBrand(opts: any): Promise<Partial<Brand>> {
  return {};
}

// Helper function to get all parent folder IDs for given folder IDs
async function getAllParentFolderIds(
  folderIds: string[],
  dataroomId: string,
): Promise<string[]> {
  if (folderIds.length === 0) return [];

  const allRequiredFolderIds = new Set(folderIds);

  // Get all folders in the dataroom to build the hierarchy
  const allFolders = await prisma.dataroomFolder.findMany({
    where: { dataroomId },
    select: { id: true, parentId: true },
  });

  // Use Map for O(1) parent lookup: folderId -> parentId
  const folderMap = new Map(
    allFolders.map((folder) => [folder.id, folder.parentId]),
  );

  // For each accessible folder, traverse up to find all parent folders
  for (const folderId of folderIds) {
    let currentId: string | null = folderId;
    while (currentId) {
      allRequiredFolderIds.add(currentId);
      currentId = folderMap.get(currentId) || null;
    }
  }

  return Array.from(allRequiredFolderIds);
}

// ============================================================================
// Data Fetchers
// ============================================================================

export async function fetchDataroomLinkData({
  linkId,
  dataroomId,
  teamId,
  groupId,
  permissionGroupId,
}: {
  linkId: string;
  dataroomId: string | null;
  teamId: string;
  groupId?: string;
  permissionGroupId?: string;
}) {
  let groupPermissions:
    | ViewerGroupAccessControls[]
    | PermissionGroupAccessControls[] = [];
  let documentIds: string[] = [];
  let folderIds: string[] = [];
  let allRequiredFolderIds: string[] = [];

  const effectiveGroupId = groupId || permissionGroupId;

  if (effectiveGroupId) {
    if (groupId) {
      groupPermissions = await prisma.viewerGroupAccessControls.findMany({
        where: {
          groupId: groupId,
          OR: [{ canView: true }, { canDownload: true }],
        },
      });
    } else if (permissionGroupId) {
      groupPermissions = await prisma.permissionGroupAccessControls.findMany({
        where: {
          groupId: permissionGroupId,
          OR: [{ canView: true }, { canDownload: true }],
        },
      });
    }

    documentIds = groupPermissions
      .filter(
        (permission) => permission.itemType === ItemType.DATAROOM_DOCUMENT,
      )
      .map((permission) => permission.itemId);
    folderIds = groupPermissions
      .filter((permission) => permission.itemType === ItemType.DATAROOM_FOLDER)
      .map((permission) => permission.itemId);

    allRequiredFolderIds = folderIds;
    if (dataroomId && folderIds.length > 0) {
      allRequiredFolderIds = await getAllParentFolderIds(folderIds, dataroomId);
    }
  }

  const linkData = await prisma.link.findUnique({
    where: { id: linkId, teamId },
    select: {
      brandId: true,
      dataroom: {
        select: {
          id: true,
          name: true,
          description: true,
          teamId: true,
          brandId: true,
          isFrozen: true,
          allowBulkDownload: true,
          showLastUpdated: true,
          introductionEnabled: true,
          introductionContent: true,
          createdAt: true,
          documents: {
            where:
              groupPermissions.length > 0 || effectiveGroupId
                ? { id: { in: documentIds } }
                : undefined,
            select: {
              id: true,
              folderId: true,
              updatedAt: true,
              orderIndex: true,
              hierarchicalIndex: true,
              document: {
                select: {
                  id: true,
                  name: true,
                  advancedExcelEnabled: true,
                  downloadOnly: true,
                  versions: {
                    where: { isPrimary: true },
                    select: {
                      id: true,
                      versionNumber: true,
                      type: true,
                      hasPages: true,
                      file: true,
                      isVertical: true,
                      updatedAt: true,
                    },
                    take: 1,
                  },
                },
              },
            },
            orderBy: [
              { orderIndex: "asc" },
              {
                document: { name: "asc" },
              },
            ],
          },
          folders: {
            where:
              groupPermissions.length > 0 || effectiveGroupId
                ? { id: { in: allRequiredFolderIds } }
                : undefined,
            select: {
              id: true,
              name: true,
              path: true,
              parentId: true,
              dataroomId: true,
              orderIndex: true,
              hierarchicalIndex: true,
              icon: true,
              color: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
          },
        },
      },
      group: {
        select: {
          accessControls: true,
        },
      },
      permissionGroup: {
        select: {
          accessControls: true,
        },
      },
    },
  });

  if (!linkData?.dataroom || linkData.dataroom.teamId !== teamId) {
    throw new Error("Dataroom not found");
  }

  linkData.dataroom.documents = sortItemsByIndexAndName(
    linkData.dataroom.documents,
  );

  const dataroomBrand = await prisma.dataroomBrand.findFirst({
    where: { dataroomId: linkData.dataroom.id },
    select: {
      logo: true,
      hideLogo: true,
      banner: true,
      brandColor: true,
      accentColor: true,
      accentButtonColor: true,
      applyAccentColorToDataroomView: true,
      welcomeMessage: true,
      cardLayout: true,
      showFolderTree: true,
      viewerLayoutPreset: true,
      viewerHeaderStyle: true,
      hideFolderIconsInMain: true,
      ctaLabel: true,
      ctaUrl: true,
      defaultLanguage: true,
    },
  });

  // Local fallback: always return either the custom brand or null
  const brand = dataroomBrand || null;

  const accessControls =
    linkData.group?.accessControls ||
    linkData.permissionGroup?.accessControls ||
    [];

  return { linkData, brand, accessControls };
}

export async function fetchDataroomDocumentLinkData({
  linkId,
  teamId,
  dataroomDocumentId,
  groupId,
  permissionGroupId,
}: {
  linkId: string;
  teamId: string;
  dataroomDocumentId: string;
  groupId?: string;
  permissionGroupId?: string;
}) {
  let groupPermissions:
    | ViewerGroupAccessControls[]
    | PermissionGroupAccessControls[] = [];

  const effectiveGroupId = groupId || permissionGroupId;

  if (effectiveGroupId) {
    let hasAccess = false;

    if (groupId) {
      groupPermissions = await prisma.viewerGroupAccessControls.findMany({
        where: {
          groupId: groupId,
          itemId: dataroomDocumentId,
          itemType: ItemType.DATAROOM_DOCUMENT,
          OR: [{ canView: true }, { canDownload: true }],
        },
      });
      hasAccess = groupPermissions.length > 0;
    } else if (permissionGroupId) {
      groupPermissions = await prisma.permissionGroupAccessControls.findMany({
        where: {
          groupId: permissionGroupId,
          itemId: dataroomDocumentId,
          itemType: ItemType.DATAROOM_DOCUMENT,
          OR: [{ canView: true }, { canDownload: true }],
        },
      });
      hasAccess = groupPermissions.length > 0;
    }

    if (!hasAccess) {
      const viewerUpload = await prisma.documentUpload.findFirst({
        where: { linkId, dataroomDocumentId },
        select: { id: true },
      });
      if (viewerUpload) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      throw new Error("Document not found in group");
    }
  }

  const linkData = await prisma.link.findUnique({
    where: { id: linkId, teamId, linkType: "DATAROOM_LINK", deletedAt: null },
    select: {
      brandId: true,
      dataroom: {
        select: {
          id: true,
          name: true,
          description: true,
          teamId: true,
          brandId: true,
          isFrozen: true,
          allowBulkDownload: true,
          showLastUpdated: true,
          documents: {
            where: { id: dataroomDocumentId },
            select: {
              id: true,
              updatedAt: true,
              orderIndex: true,
              hierarchicalIndex: true,
              document: {
                select: {
                  id: true,
                  name: true,
                  advancedExcelEnabled: true,
                  downloadOnly: true,
                  versions: {
                    where: { isPrimary: true },
                    select: {
                      id: true,
                      versionNumber: true,
                      type: true,
                      hasPages: true,
                      file: true,
                      isVertical: true,
                    },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!linkData?.dataroom || linkData.dataroom.teamId !== teamId) {
    throw new Error("Dataroom not found");
  }

  const dataroomBrand = await prisma.dataroomBrand.findFirst({
    where: { dataroomId: linkData.dataroom.id },
    select: {
      logo: true,
      hideLogo: true,
      banner: true,
      brandColor: true,
      accentColor: true,
      accentButtonColor: true,
      applyAccentColorToDataroomView: true,
      welcomeMessage: true,
      cardLayout: true,
      showFolderTree: true,
      viewerLayoutPreset: true,
      viewerHeaderStyle: true,
      hideFolderIconsInMain: true,
      ctaLabel: true,
      ctaUrl: true,
      defaultLanguage: true,
    },
  });

  const brand = dataroomBrand || null;

  return { linkData, brand };
}

export async function fetchDocumentLinkData({
  linkId,
  teamId,
}: {
  linkId: string;
  teamId: string;
}) {
  const linkData = await prisma.link.findUnique({
    where: { id: linkId, teamId, deletedAt: null },
    select: {
      brandId: true,
      document: {
        select: {
          id: true,
          name: true,
          advancedExcelEnabled: true,
          downloadOnly: true,
          teamId: true,
          ownerId: true,
          team: {
            select: { plan: true },
          },
          versions: {
            where: { isPrimary: true },
            select: {
              id: true,
              versionNumber: true,
              type: true,
              hasPages: true,
              file: true,
              isVertical: true,
            },
            take: 1,
          },
        },
      },
    },
  });

  if (!linkData?.document || linkData.document.teamId !== teamId) {
    throw new Error("Document not found");
  }

  const brand = await resolveBaseBrand({
    teamId: linkData.document.teamId,
    linkBrandId: linkData.brandId,
    select: {},
  });

  return { linkData, brand };
}

async function applyPrivacyPolicyUrlVisibility<
  T extends Record<string, any> | null,
>(
  brand: T,
  {
    teamId,
    isCustomDomain,
  }: { teamId?: string | null; isCustomDomain?: boolean },
): Promise<T> {
  if (!brand || !brand.privacyPolicyUrl) return brand;

  if (isCustomDomain && teamId) {
    const featureFlags = await getFeatureFlags({ teamId });
    if (featureFlags.customPrivacyUrl) return brand;
  }

  return { ...brand, privacyPolicyUrl: null };
}

async function processLinkData(
  link: LinkRecord,
  options: {
    dataroomDocumentId?: string;
    isCustomDomain?: boolean;
  } = {},
): Promise<LinkFetchResult> {
  const { dataroomDocumentId, isCustomDomain } = options;
  const teamPlan = link.team?.plan || "free";
  const linkType = link.linkType;

  if (isCustomDomain && teamPlan.includes("free")) {
    return { status: "free" };
  }

  if (linkType === "WORKFLOW_LINK") {
    let brand: Partial<Brand> | null = null;
    if (link.teamId) {
      const teamBrand = await resolveBaseBrand({
        teamId: link.teamId,
        linkBrandId: link.brandId,
        select: {},
      });
      brand = await applyPrivacyPolicyUrlVisibility(teamBrand, {
        teamId: link.teamId,
        isCustomDomain,
      });
    }

    const sanitizedLink = {
      ...link,
      team: undefined,
      deletedAt: undefined,
    };

    const serializedLink = JSON.parse(JSON.stringify(sanitizedLink));
    const serializedBrand = brand ? JSON.parse(JSON.stringify(brand)) : null;

    return {
      status: "ok",
      linkType,
      brand: serializedBrand,
      linkId: link.id,
      link: serializedLink,
      publicMeta: {
        enableCustomMetatag: false,
        metaTitle: null,
        metaDescription: null,
        metaImage: null,
        metaFavicon: "/favicon.ico",
      },
    };
  }

  let brand: Partial<Brand> | Partial<DataroomBrand> | null = null;
  let linkData: any;

  if (linkType === "DOCUMENT_LINK") {
    if (!link.teamId) {
      return { status: "not_found" };
    }

    try {
      const data = await fetchDocumentLinkData({
        linkId: link.id,
        teamId: link.teamId,
      });
      linkData = data.linkData;
      brand = data.brand;
    } catch {
      return { status: "not_found" };
    }
  } else if (linkType === "DATAROOM_LINK") {
    if (!link.teamId) {
      return { status: "not_found" };
    }

    if (dataroomDocumentId) {
      try {
        const data = await fetchDataroomDocumentLinkData({
          linkId: link.id,
          teamId: link.teamId,
          dataroomDocumentId: dataroomDocumentId,
          permissionGroupId: link.permissionGroupId || undefined,
          ...(link.audienceType === LinkAudienceType.GROUP &&
            link.groupId && {
              groupId: link.groupId,
            }),
        });
        linkData = data.linkData;
        brand = data.brand;
      } catch {
        return { status: "not_found" };
      }
    } else {
      try {
        const data = await fetchDataroomLinkData({
          linkId: link.id,
          dataroomId: link.dataroomId,
          teamId: link.teamId,
          permissionGroupId: link.permissionGroupId || undefined,
          ...(link.audienceType === LinkAudienceType.GROUP &&
            link.groupId && {
              groupId: link.groupId,
            }),
        });
        linkData = data.linkData;
        brand = data.brand;
        linkData.accessControls = data.accessControls;
      } catch {
        return { status: "not_found" };
      }
    }

    if (linkData?.dataroom?.isFrozen) {
      return { status: "frozen" };
    }
  }

  const sanitizedAgreement =
    link.enableAgreement && link.agreement
      ? {
          id: link.agreement.id,
          name: link.agreement.name,
          content: link.agreement.content,
          contentType: link.agreement.contentType,
          signingProvider: link.agreement.signingProvider,
          requireName: link.agreement.requireName,
        }
      : null;

  const sanitizedDocument = linkData?.document
    ? {
        id: linkData.document.id,
        name: linkData.document.name,
        teamId: linkData.document.teamId,
        team: linkData.document.team, 
        downloadOnly: linkData.document.downloadOnly,
        advancedExcelEnabled: linkData.document.advancedExcelEnabled,
        versions: linkData.document.versions,
      }
    : undefined;

  const sanitizedLink = {
    ...link,
    team: undefined,
    deletedAt: undefined,
    document: undefined,
    dataroom: undefined,
    password: link.password ? "protected" : null,
    agreement: sanitizedAgreement,
    ...(teamPlan === "free" && {
      customFields: [],
      enableAgreement: false,
      enableWatermark: false,
      permissionGroupId: null,
    }),
  };

  const returnLink = {
    ...sanitizedLink,
    ...linkData,
    document: sanitizedDocument,
    dataroomId:
      linkType === "DATAROOM_LINK"
        ? link.dataroomId || linkData?.dataroom?.id
        : undefined,
    dataroomDocument: linkData?.dataroom?.documents?.[0] || undefined,
  };

  let publicMeta: ResolvedPublicLinkMeta = {
    enableCustomMetatag: false,
    metaTitle: null,
    metaDescription: null,
    metaImage: null,
    metaFavicon: "/favicon.ico",
  };

  if (
    link.teamId &&
    (linkType === "DOCUMENT_LINK" || linkType === "DATAROOM_LINK")
  ) {
    let defaultTitle = "Shared link | Powered by Papermark";
    if (linkType === "DOCUMENT_LINK" && linkData?.document?.name) {
      defaultTitle = `${linkData.document.name} | Powered by Papermark`;
    } else if (linkType === "DATAROOM_LINK") {
      const docName =
        linkData?.dataroom?.documents?.[0]?.document?.name ?? null;
      if (docName) {
        defaultTitle = `${docName} | Powered by Papermark`;
      } else if (linkData?.dataroom?.name) {
        defaultTitle = `${linkData.dataroom.name} | Powered by Papermark`;
      }
    }
    // Local fallback for meta data
    publicMeta = {
      enableCustomMetatag: !!link.enableCustomMetatag,
      metaTitle: link.metaTitle || defaultTitle,
      metaDescription: link.metaDescription,
      metaImage: link.metaImage,
      metaFavicon: link.metaFavicon || "/favicon.ico",
    };
  }

  const [dataroomIndexEnabledForViewer, visibleBrand] = await Promise.all([
    linkType === "DATAROOM_LINK" && link.teamId
      ? resolveDataroomIndexEnabledForViewer({ teamId: link.teamId, teamPlan })
      : Promise.resolve(undefined),
    applyPrivacyPolicyUrlVisibility(brand, {
      teamId: link.teamId,
      isCustomDomain,
    }),
  ]);

  const serializedLink = JSON.parse(JSON.stringify(returnLink));
  const serializedBrand = visibleBrand
    ? JSON.parse(JSON.stringify(visibleBrand))
    : null;

  return {
    status: "ok",
    linkType,
    link: serializedLink,
    brand: serializedBrand,
    publicMeta: JSON.parse(JSON.stringify(publicMeta)),
    ...(dataroomIndexEnabledForViewer !== undefined && {
      dataroomIndexEnabledForViewer,
    }),
  };
}

export async function fetchLinkDataById({
  linkId,
  dataroomDocumentId,
}: {
  linkId: string;
  dataroomDocumentId?: string;
}): Promise<LinkFetchResult> {
  const link = await prisma.link.findUnique({
    where: { id: linkId },
    select: linkSelect,
  });

  if (!link) {
    return { status: "not_found" };
  }

  if (link.deletedAt) {
    return { status: "deleted" };
  }

  if (link.isArchived) {
    return { status: "archived" };
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return { status: "expired" };
  }

  return processLinkData(link, { dataroomDocumentId, isCustomDomain: false });
}

export async function fetchLinkDataByDomainSlug({
  domain,
  slug,
  dataroomDocumentId,
}: {
  domain: string;
  slug: string;
  dataroomDocumentId?: string;
}): Promise<LinkFetchResult> {
  const link = await prisma.link.findUnique({
    where: {
      domainSlug_slug: {
        slug: slug,
        domainSlug: domain,
      },
    },
    select: linkSelect,
  });

  if (!link) {
    return { status: "not_found" };
  }

  if (link.deletedAt) {
    return { status: "deleted" };
  }

  if (link.isArchived) {
    return { status: "archived" };
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return { status: "expired" };
  }

  return processLinkData(link, { dataroomDocumentId, isCustomDomain: true });
}

export const fetchCustomDomainLinkData = fetchLinkDataByDomainSlug;
export type CustomDomainLinkResult = LinkFetchResult;