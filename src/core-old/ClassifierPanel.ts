import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";

export class ClassifierPanel {
  private components: OBC.Components;
  private classifier: OBC.Classifier;
  private fragments: OBC.FragmentsManager;

  constructor(components: OBC.Components, fragments: OBC.FragmentsManager) {
    this.components = components;
    this.classifier = this.components.get(OBC.Classifier);
    this.fragments = fragments;
  }

  public async init() {

    BUI.Manager.init();

    const addDefaultGroupings = async () => {
      await this.classifier.byCategory();
      await this.classifier.byIfcBuildingStorey({
        classificationName: "Levels",
      });
    };

    type GroupsTableData = {
      Classification: string;
      Name: string;
      Actions: string;
    };

    interface GroupsTableState {
      components: OBC.Components;
    }

    const groupsTableTemplate = (_state: GroupsTableState) => {
      const onCreated = (e?: Element) => {
        if (!e) return;
        const table = e as BUI.Table<GroupsTableData>;

        table.loadFunction = async () => {
          const data: BUI.TableGroupData<GroupsTableData>[] = [];

          for (const [classification, groups] of this.classifier.list) {
            for (const [name] of groups) {
              data.push({
                data: {
                  Name: name,
                  Classification: classification,
                  Actions: "",
                },
              });
            }
          }

          return data;
        };

        table.loadData(true);
      };

      return BUI.html`
      <bim-table ${BUI.ref(onCreated)}></bim-table>
    `;
    };

    const [groupsTable, updateTable] = BUI.Component.create<
      BUI.Table<GroupsTableData>,
      GroupsTableState
    >(groupsTableTemplate, {
      components: this.components,
    } as GroupsTableState);

    groupsTable.style.maxHeight = "25rem";
    groupsTable.hiddenColumns = ["Classification"];
    groupsTable.columns = ["Name", { name: "Actions", width: "auto" }];
    groupsTable.noIndentation = true;
    groupsTable.headersHidden = true;
    groupsTable.dataTransform = {
      Actions: (_, rowData) => {
        const { Name, Classification } = rowData;
        if (!(Name && Classification)) return _;
        const classification = this.classifier.list.get(Classification);
        if (!classification) return _;
        const groupData = classification.get(Name);
        if (!groupData) return _;

        const hider = this.components.get(OBC.Hider);
        const onClick = async ({ target }: { target: BUI.Button }) => {
          target.loading = true;
          const modelIdMap = await groupData.get();
          await hider.isolate(modelIdMap);
          target.loading = false;
        };

        return BUI.html`<bim-button icon="solar:cursor-bold" @click=${onClick}></bim-button>`;
      },
    };

    this.classifier.list.onItemSet.add(() => setTimeout(() => updateTable()));

    const panel = BUI.Component.create<BUI.PanelSection>(() => {
      const onResetVisibility = async ({ target }: { target: BUI.Button }) => {
        target.loading = true;
        const hider = this.components.get(OBC.Hider);
        await hider.set(true);
        target.loading = false;
      };

      const onAddDefaults = async () => {
        await addDefaultGroupings();
      };

      return BUI.html`
      <bim-panel active label="Classifier Tutorial" class="options-menu">
        <bim-panel-section style="min-width: 14rem" label="General">
          <bim-button label="Reset Visibility" @click=${onResetVisibility}></bim-button>
        </bim-panel-section>
        <bim-panel-section label="Groupings">
          <bim-button label="Add Defaults" @click=${onAddDefaults}></bim-button>
          ${groupsTable}
        </bim-panel-section>
      </bim-panel>
    `;
    });

    document.body.append(panel);

    /* MD
    And we will make some logic that adds a button to the screen when the user is visiting our app from their phone, allowing to show or hide the menu. Otherwise, the menu would make the app unusable.
  */

    const button = BUI.Component.create<BUI.PanelSection>(() => {
      return BUI.html`
        <bim-button class="phone-menu-toggler" icon="solar:settings-bold"
          @click="${() => {
            if (panel.classList.contains("options-menu-visible")) {
              panel.classList.remove("options-menu-visible");
            } else {
              panel.classList.add("options-menu-visible");
            }
          }}">
        </bim-button>
      `;
    });

    document.body.append(button);
  }

}
