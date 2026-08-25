import { useState } from "react";

// --- ERSATZ FÜR FEHLENDE PREMIUM (EE) FEATURES ---
const ConfidentialViewSection = (props: any) => null;
const PlanEnum = { DataRooms: "DataRooms", DataRoomsPlus: "DataRoomsPlus", Business: "Business", Pro: "Pro" };
// --------------------------------------------------

import { LinkAudienceType, LinkType } from "@prisma/client";
import { LinkPreset } from "@prisma/client";
import { ChevronDown } from "lucide-react";

import { useFeatureFlags } from "@/lib/hooks/use-feature-flags";
import { usePlan } from "@/lib/swr/use-billing";
import useLimits from "@/lib/swr/use-limits";
import { cn } from "@/lib/utils";

import { UpgradePlanModal } from "@/components/billing/upgrade-plan-modal";
import { DEFAULT_LINK_TYPE } from "@/components/links/link-sheet";
import AllowBlockListSection from "@/components/links/link-sheet/allow-block-list-section";
import AllowDownloadSection from "@/components/links/link-sheet/allow-download-section";
import AllowListSection from "@/components/links/link-sheet/allow-list-section";
import AllowNotificationSection from "@/components/links/link-sheet/allow-notification-section";
import DenyListSection from "@/components/links/link-sheet/deny-list-section";
import EmailAccessSection from "@/components/links/link-sheet/email-access-section";
import EmailAuthenticationSection from "@/components/links/link-sheet/email-authentication-section";
import EmailProtectionSection from "@/components/links/link-sheet/email-protection-section";
import ExpirationSection from "@/components/links/link-sheet/expiration-section";
import FeedbackSection from "@/components/links/link-sheet/feedback-section";
import OGSection from "@/components/links/link-sheet/og-section";
import PasswordSection from "@/components/links/link-sheet/password-section";
import { ProBannerSection } from "@/components/links/link-sheet/pro-banner-section";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

import AgreementSection from "./agreement-section";
import AIAgentsSection from "./ai-agents-section";
import { BrandSection } from "./brand-section";
import ConversationSection from "./conversation-section";
import CustomFieldsSection from "./custom-fields-section";
import IndexFileSection from "./index-file-section";
import QuestionSection from "./question-section";
import ScreenshotProtectionSection from "./screenshot-protection-section";
import UploadSection from "./upload-section";
import WatermarkSection from "./watermark-section";
import { WelcomeMessageSection } from "./welcome-message-section";

export type LinkUpgradeOptions = {
  state: boolean;
  trigger: string;
  plan?: "Pro" | "Business" | "Data Rooms" | "Data Rooms Plus";
  highlightItem?: string[];
};

// Collapsible Section Component
const CollapsibleSection = ({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="group relative mb-5 mt-4 flex w-full items-center">
        <Separator className="absolute top-1/2 -translate-y-1/2" />
        <div className="relative mx-auto flex items-center gap-1.5 bg-background px-3 dark:bg-gray-900">
          <span className="text-sm text-muted-foreground transition-colors group-hover:text-foreground">
            {title}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground",
              isOpen ? "rotate-180" : "",
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="pt-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const LinkOptions = ({
  data,
  setData,
  targetId,
  linkType,
  editLink,
  currentPreset = null,
  setValidationError,
  defaultExpandSections = true,
  dataroomStyle = false,
}: {
  data: DEFAULT_LINK_TYPE;
  setData: React.Dispatch<React.SetStateAction<DEFAULT_LINK_TYPE>>;
  targetId?: string;
  linkType: Omit<LinkType, "WORKFLOW_LINK">;
  editLink?: boolean;
  currentPreset?: LinkPreset | null;
  setValidationError?: (key: string, errors: string[]) => void;
  defaultExpandSections?: boolean;
  dataroomStyle?: boolean;
}) => {
  const {
    isStarter,
    isPro,
    isBusiness,
    isDatarooms,
    isDataroomsPlus,
    isTrial,
  } = usePlan();
  const { limits } = useLimits();
  const { isFeatureEnabled } = useFeatureFlags();
  const isAIFeatureEnabled = isFeatureEnabled("ai");
  const showAdvancedControls =
    linkType === LinkType.DATAROOM_LINK || isAIFeatureEnabled;
  const useDataroomStyleLayout =
    linkType === LinkType.DATAROOM_LINK || dataroomStyle;
  const allowAdvancedLinkControls = limits
    ? limits?.advancedLinkControlsOnPro
    : false;
  const allowWatermarkOnBusiness = limits?.watermarkOnBusiness ?? false;
  const allowAgreementOnBusiness = limits?.agreementOnBusiness ?? false;

  const [openUpgradeModal, setOpenUpgradeModal] = useState<boolean>(false);
  const [trigger, setTrigger] = useState<string>("");
  const [upgradePlan, setUpgradePlan] = useState<any>(PlanEnum.Business);
  const [highlightItem, setHighlightItem] = useState<string[]>([]);

  const handleUpgradeStateChange = ({
    state,
    trigger,
    plan,
    highlightItem,
  }: LinkUpgradeOptions) => {
    setOpenUpgradeModal(state);
    setTrigger(trigger);
    if (plan) {
      setUpgradePlan(plan);
    }
    setHighlightItem(highlightItem || []);
  };

  const securityControls = (
    <div>
      <PasswordSection {...{ data, setData }} />
      <ExpirationSection {...{ data, setData }} presets={currentPreset} />
      {useDataroomStyleLayout && (
        <AllowDownloadSection {...{ data, setData }} />
      )}
      <ScreenshotProtectionSection
        {...{ data, setData }}
        isAllowed={
          isTrial ||
          (isPro && allowAdvancedLinkControls) ||
          isBusiness ||
          isDatarooms ||
          isDataroomsPlus
        }
        handleUpgradeStateChange={handleUpgradeStateChange}
      />
      <ConfidentialViewSection
        {...{ data, setData }}
        isAllowed={isTrial || isBusiness || isDatarooms || isDataroomsPlus}
        handleUpgradeStateChange={handleUpgradeStateChange}
      />
      <WatermarkSection
        {...{ data, setData }}
        isAllowed={
          isTrial || isDatarooms || isDataroomsPlus || allowWatermarkOnBusiness
        }
        handleUpgradeStateChange={handleUpgradeStateChange}
        presets={currentPreset}
      />
      <AgreementSection
        {...{ data, setData }}
        isAllowed={
          isTrial || isDatarooms || isDataroomsPlus || allowAgreementOnBusiness
        }
        handleUpgradeStateChange={handleUpgradeStateChange}
      />
    </div>
  );

  return (
    <div>
      {!useDataroomStyleLayout && (
        <AllowNotificationSection {...{ data, setData }} />
      )}
      {useDataroomStyleLayout ? (
        <EmailAccessSection
          {...{ data, setData }}
          isAllowed={
            isTrial ||
            (isPro && allowAdvancedLinkControls) ||
            isBusiness ||
            isDatarooms ||
            isDataroomsPlus
          }
          handleUpgradeStateChange={handleUpgradeStateChange}
        />
      ) : (
        <>
          <EmailProtectionSection {...{ data, setData }} />
          <EmailAuthenticationSection
            {...{ data, setData }}
            isAllowed={
              isTrial ||
              (isPro && allowAdvancedLinkControls) ||
              isBusiness ||
              isDatarooms ||
              isDataroomsPlus
            }
            handleUpgradeStateChange={handleUpgradeStateChange}
          />
        </>
      )}
      {!useDataroomStyleLayout && (
        <AllowDownloadSection {...{ data, setData }} />
      )}

      {data.audienceType === LinkAudienceType.GENERAL ? (
        useDataroomStyleLayout ? (
          <AllowBlockListSection
            key={`allow-block-${data.id ?? "new"}`}
            {...{ data, setData }}
            isAllowed={
              isTrial ||
              (isPro && allowAdvancedLinkControls) ||
              isBusiness ||
              isDatarooms ||
              isDataroomsPlus
            }
            handleUpgradeStateChange={handleUpgradeStateChange}
            presets={currentPreset}
            setValidationError={setValidationError}
          />
        ) : (
          <>
            <AllowListSection
              key={`allow-list-${data.id ?? "new"}`}
              {...{ data, setData }}
              isAllowed={
                isTrial ||
                (isPro && allowAdvancedLinkControls) ||
                isBusiness ||
                isDatarooms ||
                isDataroomsPlus
              }
              handleUpgradeStateChange={handleUpgradeStateChange}
              presets={currentPreset}
              setValidationError={setValidationError}
            />
            <DenyListSection
              key={`deny-list-${data.id ?? "new"}`}
              {...{ data, setData }}
              isAllowed={
                isTrial ||
                (isPro && allowAdvancedLinkControls) ||
                isBusiness ||
                isDatarooms ||
                isDataroomsPlus
              }
              handleUpgradeStateChange={handleUpgradeStateChange}
              presets={currentPreset}
              setValidationError={setValidationError}
            />
          </>
        )
      ) : null}

      {useDataroomStyleLayout ? (
        securityControls
      ) : (
        <CollapsibleSection title="Security controls" defaultOpen={true}>
          {securityControls}
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Custom branding"
        defaultOpen={defaultExpandSections}
      >
        <div>
          <BrandSection
            data={data}
            setData={setData}
            linkType={linkType}
            dataroomId={linkType === "DATAROOM_LINK" ? targetId : undefined}
          />
          <CustomFieldsSection
            {...{ data, setData }}
            isAllowed={
              isTrial ||
              isBusiness ||
              isDatarooms ||
              isDataroomsPlus ||
              (limits?.linkCustomFields ?? 0) > 0
            }
            handleUpgradeStateChange={handleUpgradeStateChange}
            presets={currentPreset}
          />
          <WelcomeMessageSection
            data={data}
            setData={setData}
            isAllowed={isTrial || isBusiness || isDatarooms || isDataroomsPlus}
            handleUpgradeStateChange={handleUpgradeStateChange}
          />
          <OGSection
            {...{ data, setData }}
            isAllowed={
              isTrial ||
              (isPro && allowAdvancedLinkControls) ||
              isBusiness ||
              isDatarooms ||
              isDataroomsPlus
            }
            handleUpgradeStateChange={handleUpgradeStateChange}
            editLink={editLink ?? false}
            presets={currentPreset}
          />
          <ProBannerSection
            {...{ data, setData }}
            isAllowed={
              isTrial ||
              isPro ||
              isBusiness ||
              isDatarooms ||
              isDataroomsPlus ||
              isStarter
            }
            handleUpgradeStateChange={handleUpgradeStateChange}
          />
        </div>
      </CollapsibleSection>

      {showAdvancedControls && (
        <CollapsibleSection
          title="Advanced controls"
          defaultOpen={defaultExpandSections}
        >
          <div>
            <AIAgentsSection
              {...{ data, setData }}
              isAllowed={
                isTrial || isBusiness || isDatarooms || isDataroomsPlus
              }
              handleUpgradeStateChange={handleUpgradeStateChange}
            />

            {linkType === LinkType.DATAROOM_LINK ? (
              <>
                {targetId ? (
                  <UploadSection
                    {...{ data, setData }}
                    isAllowed={
                      isTrial ||
                      isDataroomsPlus ||
                      (isDatarooms && limits?.dataroomUpload === true)
                    }
                    handleUpgradeStateChange={handleUpgradeStateChange}
                    targetId={targetId}
                  />
                ) : null}

                <IndexFileSection
                  {...{ data, setData }}
                  isAllowed={isTrial || isDataroomsPlus}
                  handleUpgradeStateChange={handleUpgradeStateChange}
                />

                <ConversationSection
                  {...{ data, setData }}
                  isAllowed={
                    isTrial ||
                    isDataroomsPlus ||
                    ((isBusiness || isDatarooms) &&
                      !!limits?.conversationsInDataroom)
                  }
                  handleUpgradeStateChange={handleUpgradeStateChange}
                />
              </>
            ) : null}
          </div>
        </CollapsibleSection>
      )}

      <UpgradePlanModal
        clickedPlan={upgradePlan}
        open={openUpgradeModal}
        setOpen={setOpenUpgradeModal}
        trigger={trigger}
        highlightItem={highlightItem}
      />
    </div>
  );
};